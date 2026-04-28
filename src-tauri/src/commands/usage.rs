use chrono::{Local, NaiveDate, Utc};
use sqlx::Row;
use tauri::State;

use crate::{
    helpers::name_helper::format_duration,
    state::{AppDailyUsage, AppState, AppUsageStats, DashboardData, MonitoringTrend},
};

fn date_str_to_utc(date_str: &str) -> Result<chrono::DateTime<Utc>, String> {
    NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
        .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc())
        .map_err(|e| format!("Failed to parse date '{}': {}", date_str, e))
}

/// Translates a period string into a SQL comparison operator and a date string
/// computed in Rust. Bound parameters instead of inline SQLite date expressions
/// keep date logic testable and in one place.
fn period_to_date_range(period: &str) -> (&'static str, String) {
    let today = Local::now().date_naive();
    match period {
        "yesterday" => ("=",  (today - chrono::Duration::days(1)).format("%Y-%m-%d").to_string()),
        "week"      => (">=", (today - chrono::Duration::days(6)).format("%Y-%m-%d").to_string()),
        "month"     => (">=", (today - chrono::Duration::days(29)).format("%Y-%m-%d").to_string()),
        _           => ("=",  today.format("%Y-%m-%d").to_string()),
    }
}

#[tauri::command]
pub async fn get_app_usage_history(
    state: State<'_, AppState>,
    limit: Option<i32>,
) -> Result<Vec<AppUsageStats>, String> {
    log::debug!("[CMD] get_app_usage_history limit={:?}", limit);
    let limit = limit.unwrap_or(100);

    let rows = sqlx::query(
            r#"
            SELECT u.id, a.name AS app_name, u.date, u.duration
            FROM app_usage u
            JOIN apps a ON a.id = u.app_id
            ORDER BY u.date DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&state.db)
        .await
        .map_err(|e| format!("Database query failed: {}", e))?;

    let mut history = Vec::new();
    for row in rows {
        let date_str: String = row.get("date");
        let timestamp = date_str_to_utc(&date_str)?;
        let duration_seconds: i64 = row.get("duration");

        history.push(AppUsageStats {
            id: Some(row.get("id")),
            app_name: row.get("app_name"),
            timestamp,
            duration: duration_seconds,
            formatted_duration: format_duration(duration_seconds),
        });
    }

    Ok(history)
}

#[tauri::command]
pub async fn get_app_usage_stats(
    state: State<'_, AppState>,
    period: Option<String>,
) -> Result<Vec<AppUsageStats>, String> {
    log::debug!("[CMD] get_app_usage_stats period={:?}", period);

    let (op, date) = period_to_date_range(period.as_deref().unwrap_or("today"));

    let query = format!(
        r#"
        SELECT a.id, a.name AS app_name,
               SUM(u.duration) AS total_duration,
               MAX(u.date) AS latest_date
        FROM app_usage u
        JOIN apps a ON a.id = u.app_id
        WHERE u.date {op} ?
          AND NOT EXISTS (
              SELECT 1 FROM user_preferences
              WHERE key = 'ignored_app:' || a.name AND value = 'true'
          )
        GROUP BY a.id
        ORDER BY total_duration DESC
        "#
    );

    let rows = sqlx::query(&query)
        .bind(date)
        .fetch_all(&state.db)
        .await
        .map_err(|e| format!("Database query failed: {}", e))?;

    let mut stats = Vec::new();
    for row in rows {
        let date_str: String = row.get("latest_date");
        let timestamp = date_str_to_utc(&date_str)?;
        let duration_seconds: i64 = row.get("total_duration");

        stats.push(AppUsageStats {
            id: Some(row.get("id")),
            app_name: row.get("app_name"),
            timestamp,
            duration: duration_seconds,
            formatted_duration: format_duration(duration_seconds),
        });
    }

    Ok(stats)
}

#[tauri::command]
pub async fn get_total_monitoring_time(
    state: State<'_, AppState>,
    period: Option<String>,
) -> Result<i64, String> {
    log::debug!("[CMD] get_total_monitoring_time period={:?}", period);

    let (op, date) = period_to_date_range(period.as_deref().unwrap_or("today"));

    let query = format!(
        "SELECT COALESCE(SUM(total_seconds), 0) as total_seconds FROM monitoring_stats WHERE date {op} ?"
    );

    let row = sqlx::query(&query)
        .bind(date)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.get::<i64, _>("total_seconds"))
}

#[tauri::command]
pub async fn get_app_daily_usage(
    state: State<'_, AppState>,
    app_name: String,
) -> Result<Vec<AppDailyUsage>, String> {
    log::debug!("[CMD] get_app_daily_usage app_name={}", app_name);

    let rows = sqlx::query(
            r#"
            SELECT u.date, u.duration
            FROM app_usage u
            JOIN apps a ON a.id = u.app_id
            WHERE a.name = ? AND u.date >= date('now', '-29 days')
            ORDER BY u.date ASC
            "#,
        )
        .bind(&app_name)
        .fetch_all(&state.db)
        .await
        .map_err(|e| format!("Database query failed: {}", e))?;

    let result = rows
        .into_iter()
        .map(|row| {
            let duration: i64 = row.get("duration");
            AppDailyUsage {
                date: row.get("date"),
                duration,
                formatted_duration: format_duration(duration),
            }
        })
        .collect();

    Ok(result)
}

/// Returns daily total monitoring time for the last N days (for the trend chart).
/// period: "week" (7 days) or "month" (30 days). Defaults to "week".
#[tauri::command]
pub async fn get_monitoring_trend(
    state: State<'_, AppState>,
    period: Option<String>,
) -> Result<Vec<MonitoringTrend>, String> {
    log::debug!("[CMD] get_monitoring_trend period={:?}", period);

    let days_back: i64 = match period.as_deref().unwrap_or("week") {
        "month" => 29,
        _ => 6,
    };
    let trend_from = (Local::now().date_naive() - chrono::Duration::days(days_back))
        .format("%Y-%m-%d").to_string();

    let rows = sqlx::query(
        "SELECT date, total_seconds FROM monitoring_stats WHERE date >= ? ORDER BY date ASC"
    )
    .bind(trend_from)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let result = rows
        .into_iter()
        .map(|row| MonitoringTrend {
            date: row.get("date"),
            total_seconds: row.get("total_seconds"),
        })
        .collect();

    Ok(result)
}

fn build_app_stats_rows(
    rows: Vec<sqlx::sqlite::SqliteRow>,
) -> Result<Vec<AppUsageStats>, String> {
    let mut stats = Vec::new();
    for row in rows {
        let date_str: String = row.get("latest_date");
        let timestamp = date_str_to_utc(&date_str)?;
        let duration_seconds: i64 = row.get("total_duration");
        stats.push(AppUsageStats {
            id: Some(row.get("id")),
            app_name: row.get("app_name"),
            timestamp,
            duration: duration_seconds,
            formatted_duration: format_duration(duration_seconds),
        });
    }
    Ok(stats)
}

/// Single round-trip command that returns all data needed by the dashboard.
#[tauri::command]
pub async fn get_dashboard_data(
    state: State<'_, AppState>,
    period: Option<String>,
) -> Result<DashboardData, String> {
    log::debug!("[CMD] get_dashboard_data period={:?}", period);

    let p = period.as_deref().unwrap_or("today");

    let (op, period_date) = period_to_date_range(p);
    let today     = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let yesterday = (Local::now().date_naive() - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let trend_days_back: i64 = if p == "month" { 29 } else { 6 };
    let trend_from = (Local::now().date_naive() - chrono::Duration::days(trend_days_back))
        .format("%Y-%m-%d").to_string();

    let apps_sql = format!(
        r#"SELECT a.id, a.name AS app_name,
               SUM(u.duration) AS total_duration,
               MAX(u.date) AS latest_date
        FROM app_usage u
        JOIN apps a ON a.id = u.app_id
        WHERE u.date {op} ?
          AND NOT EXISTS (
              SELECT 1 FROM user_preferences
              WHERE key = 'ignored_app:' || a.name AND value = 'true'
          )
        GROUP BY a.id
        ORDER BY total_duration DESC"#
    );
    let mon_sql = format!(
        "SELECT COALESCE(SUM(total_seconds), 0) AS total_seconds FROM monitoring_stats WHERE date {op} ?"
    );

    let (apps_rows, yesterday_rows, mon_row, today_row, trend_rows) = tokio::try_join!(
        sqlx::query(&apps_sql).bind(&period_date).fetch_all(&state.db),
        sqlx::query(
            r#"SELECT a.id, a.name AS app_name,
               SUM(u.duration) AS total_duration,
               MAX(u.date) AS latest_date
        FROM app_usage u
        JOIN apps a ON a.id = u.app_id
        WHERE u.date = ?
          AND NOT EXISTS (
              SELECT 1 FROM user_preferences
              WHERE key = 'ignored_app:' || a.name AND value = 'true'
          )
        GROUP BY a.id
        ORDER BY total_duration DESC"#
        ).bind(&yesterday).fetch_all(&state.db),
        sqlx::query(&mon_sql).bind(&period_date).fetch_one(&state.db),
        sqlx::query(
            "SELECT COALESCE(SUM(total_seconds), 0) AS total_seconds FROM monitoring_stats WHERE date = ?"
        ).bind(&today).fetch_one(&state.db),
        sqlx::query(
            "SELECT date, total_seconds FROM monitoring_stats WHERE date >= ? ORDER BY date ASC"
        ).bind(&trend_from).fetch_all(&state.db),
    )
    .map_err(|e| format!("Database query failed: {}", e))?;

    // Fetch ignored app names to exclude from the active list
    let ignored_set: std::collections::HashSet<String> = sqlx::query(
        "SELECT key FROM user_preferences WHERE key LIKE 'ignored_app:%' AND value = 'true'"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| r.get::<String, _>("key").trim_start_matches("ignored_app:").to_string())
    .collect();

    let active_apps: Vec<String> = state.active_apps.lock().await
        .iter()
        .filter(|name| !ignored_set.contains(*name))
        .cloned()
        .collect();

    let trend_data = trend_rows
        .into_iter()
        .map(|row| MonitoringTrend {
            date: row.get("date"),
            total_seconds: row.get("total_seconds"),
        })
        .collect();

    Ok(DashboardData {
        apps: build_app_stats_rows(apps_rows)?,
        yesterday_apps: build_app_stats_rows(yesterday_rows)?,
        monitoring_seconds: mon_row.get("total_seconds"),
        total_seconds_today: today_row.get("total_seconds"),
        active_apps,
        trend_data,
    })
}

/// Returns the logo_base64 for a single app by name (for lazy loading).
#[tauri::command]
pub async fn get_app_logo(
    state: State<'_, AppState>,
    app_name: String,
) -> Result<Option<String>, String> {
    log::debug!("[CMD] get_app_logo app_name={}", app_name);
    let row = sqlx::query("SELECT logo_base64 FROM apps WHERE name = ?")
        .bind(&app_name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.and_then(|r| r.get("logo_base64")))
}
