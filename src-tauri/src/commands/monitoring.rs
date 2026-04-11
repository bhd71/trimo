use std::{collections::HashSet, sync::Arc, time::Duration};

use lru::LruCache;
use sqlx::{Row, sqlite::SqlitePool};
use tauri::State;
use tokio::{sync::Mutex, task::JoinHandle};

use crate::{
    logo::{create_placeholder_logo, extract_app_logo},
    process::{get_foreground_app_name, get_opened_apps_with_info, is_process_safe_to_monitor, AppInfo},
    state::AppState,
};

/// Starts the monitoring loop if not already running. Safe to call from any async context.
pub async fn start_monitoring_inner(
    db: Arc<Mutex<SqlitePool>>,
    logo_cache: Arc<Mutex<LruCache<String, Option<String>>>>,
    active_apps: Arc<Mutex<Vec<String>>>,
    current_exe_name: String,
    task_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    interval_secs: u64,
    app_handle: tauri::AppHandle,
    notification_fired: Arc<Mutex<HashSet<String>>>,
    focus_app: Arc<Mutex<Option<String>>>,
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

            if let Err(e) =
                perform_monitoring_cycle(&db, &logo_cache, &active_apps, interval_secs as i64, &current_exe_name, &app_handle, &notification_fired, &focus_app)
                    .await
            {
                log::error!("Error in monitoring cycle: {}", e);
                continue;
            }

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

async fn read_saved_interval(db: &Arc<Mutex<SqlitePool>>) -> u64 {
    let db_guard = db.lock().await;
    sqlx::query("SELECT value FROM user_preferences WHERE key = 'monitoring_interval'")
        .fetch_optional(&*db_guard)
        .await
        .ok()
        .flatten()
        .and_then(|r| {
            let v: String = sqlx::Row::get(&r, "value");
            v.parse::<u64>().ok()
        })
        .unwrap_or(1)
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
            state.notification_fired.clone(),
            state.focus_app.clone(),
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
    {
        let db = tokio::time::timeout(Duration::from_secs(5), state.db.lock())
            .await
            .map_err(|_| "Database lock timeout")?;
        sqlx::query(
            "INSERT INTO user_preferences (key, value) VALUES ('monitoring_interval', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(interval_seconds.to_string())
        .execute(&*db)
        .await
        .map_err(|e| e.to_string())?;
    }

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
            state.notification_fired.clone(),
            state.focus_app.clone(),
        )
        .await;
    }

    Ok(())
}

async fn perform_monitoring_cycle(
    db: &Arc<Mutex<SqlitePool>>,
    logo_cache: &Arc<Mutex<LruCache<String, Option<String>>>>,
    active_apps: &Arc<Mutex<Vec<String>>>,
    interval_seconds: i64,
    current_exe_name: &str,
    app_handle: &tauri::AppHandle,
    notification_fired: &Arc<Mutex<HashSet<String>>>,
    focus_app: &Arc<Mutex<Option<String>>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let apps_info = get_opened_apps_with_info(current_exe_name);

    if apps_info.is_empty() {
        *active_apps.lock().await = Vec::new();
        *focus_app.lock().await = None;
        return Ok(());
    }

    let filtered_apps: Vec<AppInfo> = apps_info
        .into_iter()
        .filter(|app| is_process_safe_to_monitor(&app.name, current_exe_name))
        .collect();

    if filtered_apps.is_empty() {
        *active_apps.lock().await = Vec::new();
        *focus_app.lock().await = None;
        return Ok(());
    }

    // Update the shared active-apps list for list_opened_apps to read
    *active_apps.lock().await = filtered_apps.iter().map(|a| a.name.clone()).collect();

    // Determine which app is currently in focus
    let focused_name = get_foreground_app_name(current_exe_name);
    *focus_app.lock().await = focused_name.clone();

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

    let db_guard = tokio::time::timeout(Duration::from_secs(5), db.lock())
        .await
        .map_err(|_| "Database lock timeout")?;

    // Check whether focus-only tracking is enabled (default: true)
    let focus_tracking_enabled = sqlx::query(
        "SELECT value FROM user_preferences WHERE key = 'focus_tracking_enabled'"
    )
    .fetch_optional(&*db_guard)
    .await
    .ok()
    .flatten()
    .map(|r| r.get::<String, _>("value") != "false")
    .unwrap_or(true);

    let mut tx = db_guard.begin().await?;

    // Increment monitoring_stats when: focus tracking off (always active), or focused app present
    if !focus_tracking_enabled || focused_name.is_some() {
        sqlx::query(
            r#"
            INSERT INTO monitoring_stats (date, total_seconds)
            VALUES (date('now'), ?)
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
                SELECT id, date('now'), ?
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
    update_tray_tooltip(app_handle, &db_guard).await;

    drop(db_guard);

    // Fire any pending notifications (best-effort; errors are non-fatal)
    let active_names: Vec<String> = active_apps.lock().await.clone();
    check_notifications(db, app_handle, notification_fired, &active_names).await;

    Ok(())
}

async fn check_notifications(
    db: &Arc<Mutex<SqlitePool>>,
    app_handle: &tauri::AppHandle,
    notification_fired: &Arc<Mutex<HashSet<String>>>,
    active_names: &[String],
) {
    if active_names.is_empty() {
        return;
    }

    let db_guard = match tokio::time::timeout(Duration::from_secs(5), db.lock()).await {
        Ok(g) => g,
        Err(_) => return,
    };

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
    let rows = match q.fetch_all(&*db_guard).await {
        Ok(r) => r,
        Err(_) => return,
    };

    if rows.is_empty() {
        return;
    }

    let mut fired = notification_fired.lock().await;

    for row in rows {
        let app_name: String = row.get("app_name");
        let threshold: i64 = row.get("threshold_seconds");
        let message: String = row.get("message");

        if fired.contains(&app_name) {
            continue;
        }

        // Query today's total usage for this app
        let today_duration: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(u.duration), 0) FROM app_usage u JOIN apps a ON a.id = u.app_id WHERE a.name = ? AND u.date = date('now')"
        )
        .bind(&app_name)
        .fetch_one(&*db_guard)
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
            fired.insert(app_name);
        }
    }
}

async fn update_tray_tooltip(app_handle: &tauri::AppHandle, db: &SqlitePool) {
    use crate::helpers::name_helper::format_duration;

    let total: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(total_seconds), 0) FROM monitoring_stats WHERE date = date('now')",
    )
    .fetch_one(db)
    .await
    .unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT a.name AS app_name, SUM(u.duration) AS total_duration
        FROM app_usage u
        JOIN apps a ON a.id = u.app_id
        WHERE u.date = date('now')
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
