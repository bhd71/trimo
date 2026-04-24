use std::{sync::Arc, time::Duration};

use lru::LruCache;
use sqlx::{Row, sqlite::SqlitePool};
use tauri::{Emitter, State};
use tokio::{sync::Mutex, task::JoinHandle};

use crate::{
    logo::{create_placeholder_logo, extract_app_logo},
    process::{get_foreground_app_name, get_opened_apps_with_info, is_process_safe_to_monitor, is_system_idle, AppInfo},
    state::AppState,
};

/// Payload emitted on every monitoring cycle so the frontend knows whether the
/// system was idle and can update its own state without an extra IPC call.
#[derive(serde::Serialize, Clone)]
struct MonitoringTickPayload {
    is_idle: bool,
}

/// Starts the monitoring loop if not already running. Safe to call from any async context.
pub async fn start_monitoring_inner(
    db: SqlitePool,
    logo_cache: Arc<Mutex<LruCache<String, Option<String>>>>,
    active_apps: Arc<Mutex<Vec<String>>>,
    current_exe_name: String,
    task_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    interval_secs: u64,
    app_handle: tauri::AppHandle,
    focus_app: Arc<Mutex<Option<String>>>,
    last_external_focus: Arc<Mutex<Option<String>>>,
) {
    let mut handle = task_handle.lock().await;
    if handle.is_some() {
        return; // already running
    }
    log::info!("Starting monitoring with {} second intervals", interval_secs);

    let h = tokio::spawn(async move {
        log::info!("Background monitoring task started");

        let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                _ = interval.tick() => {}
                _ = tokio::signal::ctrl_c() => {
                    log::info!("Monitoring task received shutdown signal");
                    break;
                }
            }

            let is_idle = match perform_monitoring_cycle(&db, &logo_cache, &active_apps, interval_secs as i64, &current_exe_name, &app_handle, &focus_app, &last_external_focus)
                .await
            {
                Ok(idle) => idle,
                Err(e) => {
                    log::error!("Error in monitoring cycle: {}", e);
                    continue;
                }
            };

            // Notify the frontend that fresh data is ready, along with idle state
            let _ = app_handle.emit("monitoring-tick", MonitoringTickPayload { is_idle });

            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        log::info!("Background monitoring task ended");
    });

    *handle = Some(h);
}

#[tauri::command]
pub async fn get_monitoring_status(state: State<'_, AppState>) -> Result<bool, String> {
    log::debug!("[CMD] get_monitoring_status");
    let handle = state.monitoring_task.lock().await;
    Ok(handle.is_some())
}

async fn read_saved_interval(db: &SqlitePool) -> u64 {
    sqlx::query("SELECT value FROM user_preferences WHERE key = 'monitoring_interval'")
        .fetch_optional(db)
        .await
        .ok()
        .flatten()
        .and_then(|r| {
            let v: String = sqlx::Row::get(&r, "value");
            v.parse::<u64>().ok()
        })
        .unwrap_or(5)
}

#[tauri::command]
pub async fn toggle_monitoring(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    log::info!("[CMD] toggle_monitoring");

    // Release lock before calling start_monitoring_inner (which also locks task_handle)
    let is_running = {
        let mut task_handle = state.monitoring_task.lock().await;
        if let Some(handle) = task_handle.take() {
            handle.abort();
            true
        } else {
            false
        }
    };

    if is_running {
        Ok("Monitoring stopped".to_string())
    } else {
        let interval_secs = read_saved_interval(&state.db).await;
        start_monitoring_inner(
            state.db.clone(),
            state.logo_cache.clone(),
            state.active_apps.clone(),
            state.current_exe_name.clone(),
            state.monitoring_task.clone(),
            interval_secs,
            app_handle,
            state.focus_app.clone(),
            state.last_external_focus.clone(),
        )
        .await;
        Ok(format!(
            "Monitoring started with {} second intervals",
            interval_secs
        ))
    }
}

/// Saves the interval preference and seamlessly restarts monitoring if it was active.
#[tauri::command]
pub async fn apply_monitoring_interval(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    interval_seconds: u64,
) -> Result<(), String> {
    log::info!("[CMD] apply_monitoring_interval interval_seconds={}", interval_seconds);
    sqlx::query(
        "INSERT INTO user_preferences (key, value) VALUES ('monitoring_interval', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(interval_seconds.to_string())
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let was_running = {
        let mut handle = state.monitoring_task.lock().await;
        if let Some(h) = handle.take() {
            h.abort();
            true
        } else {
            false
        }
    };

    if was_running {
        start_monitoring_inner(
            state.db.clone(),
            state.logo_cache.clone(),
            state.active_apps.clone(),
            state.current_exe_name.clone(),
            state.monitoring_task.clone(),
            interval_seconds,
            app_handle,
            state.focus_app.clone(),
            state.last_external_focus.clone(),
        )
        .await;
    }

    Ok(())
}

async fn perform_monitoring_cycle(
    db: &SqlitePool,
    logo_cache: &Arc<Mutex<LruCache<String, Option<String>>>>,
    active_apps: &Arc<Mutex<Vec<String>>>,
    interval_seconds: i64,
    current_exe_name: &str,
    app_handle: &tauri::AppHandle,
    focus_app: &Arc<Mutex<Option<String>>>,
    last_external_focus: &Arc<Mutex<Option<String>>>,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let apps_info = get_opened_apps_with_info(current_exe_name);

    if apps_info.is_empty() {
        *active_apps.lock().await = Vec::new();
        *focus_app.lock().await = None;
        return Ok(false);
    }

    let filtered_apps: Vec<AppInfo> = apps_info
        .into_iter()
        .filter(|app| is_process_safe_to_monitor(&app.name, current_exe_name))
        .collect();

    if filtered_apps.is_empty() {
        *active_apps.lock().await = Vec::new();
        *focus_app.lock().await = None;
        return Ok(false);
    }

    // Update the shared active-apps list for list_opened_apps to read
    *active_apps.lock().await = filtered_apps.iter().map(|a| a.name.clone()).collect();

    // Determine which app is currently in focus.
    // get_foreground_app_name returns None when Trimo itself is the foreground window.
    // In that case fall back to the last known external focus so that time keeps
    // accumulating for the app the user was using before they switched to check stats.
    let raw_focus = get_foreground_app_name(current_exe_name);
    let focused_name = if raw_focus.is_some() {
        // Update the last-known external focus
        *last_external_focus.lock().await = raw_focus.clone();
        raw_focus
    } else {
        // Trimo is focused — keep crediting the previous external app
        last_external_focus.lock().await.clone()
    };
    *focus_app.lock().await = focused_name.clone();

    // Skip duration recording when system is idle
    let idle_threshold: u64 = sqlx::query(
        "SELECT value FROM user_preferences WHERE key = 'idle_threshold_minutes'"
    )
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.get::<String, _>("value").parse::<u64>().ok())
    .unwrap_or(5);

    if is_system_idle(idle_threshold) {
        log::debug!("System idle (>{} min), skipping duration increment", idle_threshold);
        return Ok(true);
    }

    // Resolve logos from cache before acquiring the DB lock
    let mut app_logos: Vec<(String, Option<String>)> = Vec::new();
    for app_info in &filtered_apps {
        let app_name = &app_info.name;
        let mut cache_guard = logo_cache.lock().await;
        let logo = if let Some(cached) = cache_guard.get(app_name) {
            cached.clone()
        } else {
            let resolved = if let Some(ref exe_path) = app_info.exe_path {
                extract_app_logo(exe_path)
                    .await
                    .or_else(|| Some(create_placeholder_logo(app_name)))
            } else {
                Some(create_placeholder_logo(app_name))
            };
            cache_guard.put(app_name.clone(), resolved.clone());
            resolved
        };
        drop(cache_guard);
        app_logos.push((app_name.clone(), logo));
    }

    log::debug!("Monitoring {} apps, focused: {:?}", app_logos.len(), focused_name);

    // Check whether focus-only tracking is enabled (default: true)
    let focus_tracking_enabled = sqlx::query(
        "SELECT value FROM user_preferences WHERE key = 'focus_tracking_enabled'"
    )
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
    .map(|r| r.get::<String, _>("value") != "false")
    .unwrap_or(true);

    let mut tx = db.begin().await?;

    // Increment monitoring_stats when: focus tracking off (always active), or focused app present
    if !focus_tracking_enabled || focused_name.is_some() {
        sqlx::query(
            r#"
            INSERT INTO monitoring_stats (date, total_seconds)
            VALUES (date('now', 'localtime'), ?)
            ON CONFLICT(date) DO UPDATE SET total_seconds = total_seconds + ?
            "#,
        )
        .bind(interval_seconds)
        .bind(interval_seconds)
        .execute(&mut *tx)
        .await?;
    }

    for (app_name, logo_base64) in &app_logos {
        // Always upsert the app record (ensures logo is stored)
        sqlx::query(
            r#"
            INSERT INTO apps (name, logo_base64) VALUES (?, ?)
            ON CONFLICT(name) DO UPDATE SET
                logo_base64 = COALESCE(apps.logo_base64, excluded.logo_base64)
            "#,
        )
        .bind(app_name)
        .bind(logo_base64)
        .execute(&mut *tx)
        .await?;

        // Accumulate duration: only focused app (focus mode) or all apps (all-apps mode)
        if !focus_tracking_enabled || focused_name.as_deref() == Some(app_name.as_str()) {
            sqlx::query(
                r#"
                INSERT INTO app_usage (app_id, date, duration)
                SELECT id, date('now', 'localtime'), ?
                FROM apps WHERE name = ?
                ON CONFLICT(app_id, date) DO UPDATE SET duration = duration + excluded.duration
                "#,
            )
            .bind(interval_seconds)
            .bind(app_name)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    // Update tray tooltip with today's stats (best-effort)
    update_tray_tooltip(app_handle, db).await;

    // Fire any pending notifications (best-effort; errors are non-fatal)
    let active_names: Vec<String> = active_apps.lock().await.clone();
    check_notifications(db, app_handle, &active_names).await;
    check_daily_goal(db, app_handle).await;

    Ok(false)
}

async fn check_daily_goal(db: &SqlitePool, app_handle: &tauri::AppHandle) {
    // Read the configured daily goal (0 = disabled)
    let goal_seconds: i64 = sqlx::query(
        "SELECT value FROM user_preferences WHERE key = 'daily_goal_seconds'"
    )
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.get::<String, _>("value").parse::<i64>().ok())
    .unwrap_or(0);

    if goal_seconds <= 0 {
        return;
    }

    // Already notified today?
    let already_fired: bool = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE app_name = '_daily_goal' AND date = date('now', 'localtime')"
    )
    .fetch_one(db)
    .await
    .unwrap_or(0i64) > 0;

    if already_fired {
        return;
    }

    let total_today: i64 = sqlx::query_scalar(
        "SELECT COALESCE(total_seconds, 0) FROM monitoring_stats WHERE date = date('now', 'localtime')"
    )
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);

    if total_today >= goal_seconds {
        let hours = goal_seconds / 3600;
        let mins = (goal_seconds % 3600) / 60;
        let label = match (hours, mins) {
            (h, m) if h > 0 && m > 0 => format!("{}h {}m", h, m),
            (h, _) if h > 0           => format!("{}h", h),
            (_, m)                    => format!("{}m", m),
        };
        use tauri_plugin_notification::NotificationExt;
        let _ = app_handle
            .notification()
            .builder()
            .title("Daily screen time goal reached")
            .body(&format!("You've reached your daily goal of {} screen time.", label))
            .show();
        let _ = app_handle.emit("daily-goal-reached", ());
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO notifications (app_name, date) VALUES ('_daily_goal', date('now', 'localtime'))"
        )
        .execute(db)
        .await;
    }
}

async fn check_notifications(
    db: &SqlitePool,
    app_handle: &tauri::AppHandle,
    active_names: &[String],
) {
    if active_names.is_empty() {
        return;
    }

    // Fetch enabled rules that match currently-active apps
    let placeholders = active_names
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");
    let query_str = format!(
        "SELECT app_name, threshold_seconds, message FROM app_notifications WHERE enabled = 1 AND app_name IN ({})",
        placeholders
    );
    let mut q = sqlx::query(&query_str);
    for name in active_names {
        q = q.bind(name);
    }
    let rows = match q.fetch_all(db).await {
        Ok(r) => r,
        Err(_) => return,
    };

    if rows.is_empty() {
        return;
    }

    for row in rows {
        let app_name: String = row.get("app_name");
        let threshold: i64 = row.get("threshold_seconds");
        let message: String = row.get("message");

        // Check if already fired today (persisted across restarts)
        let already_fired: bool = sqlx::query_scalar(
            "SELECT COUNT(*) FROM notifications WHERE app_name = ? AND date = date('now', 'localtime')"
        )
        .bind(&app_name)
        .fetch_one(db)
        .await
        .unwrap_or(0i64) > 0;

        if already_fired {
            continue;
        }

        // Query today's total usage for this app
        let today_duration: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(u.duration), 0) FROM app_usage u JOIN apps a ON a.id = u.app_id WHERE a.name = ? AND u.date = date('now', 'localtime')"
        )
        .bind(&app_name)
        .fetch_one(db)
        .await
        .unwrap_or(0);

        if today_duration >= threshold {
            use tauri_plugin_notification::NotificationExt;
            let _ = app_handle
                .notification()
                .builder()
                .title("Trimo")
                .body(&message)
                .show();
            // Persist that we fired today so restarts don't re-trigger
            let _ = sqlx::query(
                "INSERT OR IGNORE INTO notifications (app_name, date) VALUES (?, date('now', 'localtime'))"
            )
            .bind(&app_name)
            .execute(db)
            .await;
        }
    }
}

async fn update_tray_tooltip(app_handle: &tauri::AppHandle, db: &SqlitePool) {
    use crate::helpers::name_helper::format_duration;

    let total: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(total_seconds), 0) FROM monitoring_stats WHERE date = date('now', 'localtime')",
    )
    .fetch_one(db)
    .await
    .unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT a.name AS app_name, SUM(u.duration) AS total_duration
        FROM app_usage u
        JOIN apps a ON a.id = u.app_id
        WHERE u.date = date('now', 'localtime')
        GROUP BY a.id
        ORDER BY total_duration DESC
        LIMIT 3
        "#,
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let mut tooltip = format!("Trimo — {} today", format_duration(total));
    for (i, row) in rows.iter().enumerate() {
        let name: String = row.get("app_name");
        let dur: i64 = row.get("total_duration");
        tooltip.push_str(&format!("\n{}. {} — {}", i + 1, name, format_duration(dur)));
    }

    if let Some(tray) = app_handle.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}
