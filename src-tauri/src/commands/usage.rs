use std::time::Duration;

use chrono::{NaiveDate, Utc};
use sqlx::Row;
use tauri::State;

use crate::{
    helpers::name_helper::format_duration,
    state::{AppDailyUsage, AppState, AppUsageStats, MonitoringTrend},
};

fn date_str_to_utc(date_str: &str) -> Result<chrono::DateTime<Utc>, String> {
    NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
        .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc())
        .map_err(|e| format!("Failed to parse date '{}': {}", date_str, e))
}

#[tauri::command]
pub async fn get_app_usage_history(
    state: State<'_, AppState>,
    limit: Option<i32>,
) -> Result<Vec<AppUsageStats>, String> {
    log::debug!("[CMD] get_app_usage_history limit={:?}", limit);
    let db = match tokio::time::timeout(Duration::from_secs(5), state.db.lock()).await {
        Ok(db) => db,
        Err(_) => return Err("Database lock timeout".to_string()),
    };

    let limit = limit.unwrap_or(100);

    let rows = match tokio::time::timeout(
        Duration::from_secs(10),
        sqlx::query(
            r#"
            SELECT u.id, a.name AS app_name, u.date, u.duration, a.logo_base64
            FROM app_usage u
            JOIN apps a ON a.id = u.app_id
            ORDER BY u.date DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&*db),
    )
    .await
    {
        Ok(Ok(rows)) => rows,
        Ok(Err(e)) => return Err(format!("Database query failed: {}", e)),
        Err(_) => return Err("Database query timeout".to_string()),
    };

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
            logo_base64: row.get("logo_base64"),
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
    let db = match tokio::time::timeout(Duration::from_secs(5), state.db.lock()).await {
        Ok(db) => db,
        Err(_) => return Err("Database lock timeout".to_string()),
    };

    let date_filter = match period.as_deref().unwrap_or("today") {
        "yesterday" => "u.date = date('now', '-1 day')",
        "week"      => "u.date >= date('now', '-6 days')",
        "month"     => "u.date >= date('now', '-29 days')",
        _           => "u.date = date('now')",
    };

    let query = format!(
        r#"
        SELECT a.id, a.name AS app_name, a.logo_base64,
               SUM(u.duration) AS total_duration,
               MAX(u.date) AS latest_date
        FROM app_usage u
        JOIN apps a ON a.id = u.app_id
        WHERE {}
        GROUP BY a.id
        ORDER BY total_duration DESC
        "#,
        date_filter
    );

    let rows = match tokio::time::timeout(
        Duration::from_secs(10),
        sqlx::query(&query).fetch_all(&*db),
    )
    .await
    {
        Ok(Ok(rows)) => rows,
        Ok(Err(e)) => return Err(format!("Database query failed: {}", e)),
        Err(_) => return Err("Database query timeout".to_string()),
    };

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
            logo_base64: row.get("logo_base64"),
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
    let db = match tokio::time::timeout(Duration::from_secs(5), state.db.lock()).await {
        Ok(db) => db,
        Err(_) => return Err("Database lock timeout".to_string()),
    };

    let date_filter = match period.as_deref().unwrap_or("today") {
        "yesterday" => "date = date('now', '-1 day')",
        "week"      => "date >= date('now', '-6 days')",
        "month"     => "date >= date('now', '-29 days')",
        _           => "date = date('now')",
    };

    let query = format!(
        "SELECT COALESCE(SUM(total_seconds), 0) as total_seconds FROM monitoring_stats WHERE {}",
        date_filter
    );

    let row = sqlx::query(&query)
        .fetch_one(&*db)
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
    let db = match tokio::time::timeout(Duration::from_secs(5), state.db.lock()).await {
        Ok(db) => db,
        Err(_) => return Err("Database lock timeout".to_string()),
    };

    let rows = match tokio::time::timeout(
        Duration::from_secs(10),
        sqlx::query(
            r#"
            SELECT u.date, u.duration
            FROM app_usage u
            JOIN apps a ON a.id = u.app_id
            WHERE a.name = ? AND u.date >= date('now', '-29 days')
            ORDER BY u.date ASC
            "#,
        )
        .bind(&app_name)
        .fetch_all(&*db),
    )
    .await
    {
        Ok(Ok(rows)) => rows,
        Ok(Err(e)) => return Err(format!("Database query failed: {}", e)),
        Err(_) => return Err("Database query timeout".to_string()),
    };

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
    let db = match tokio::time::timeout(Duration::from_secs(5), state.db.lock()).await {
        Ok(db) => db,
        Err(_) => return Err("Database lock timeout".to_string()),
    };

    let days_back = match period.as_deref().unwrap_or("week") {
        "month" => 29,
        _ => 6,
    };

    let rows = sqlx::query(
        &format!(
            "SELECT date, total_seconds FROM monitoring_stats WHERE date >= date('now', '-{} days') ORDER BY date ASC",
            days_back
        )
    )
    .fetch_all(&*db)
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
