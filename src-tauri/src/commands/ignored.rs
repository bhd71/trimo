use sqlx::Row;
use tauri::State;

use crate::{helpers::name_helper::format_duration, state::{AppState, AppUsageStats}};
use chrono::Utc;

#[tauri::command]
pub async fn set_app_ignored(
    state: State<'_, AppState>,
    app_name: String,
    ignored: bool,
) -> Result<(), String> {
    log::debug!("[CMD] set_app_ignored app_name={} ignored={}", app_name, ignored);

    let key = format!("ignored_app:{}", app_name);
    let value = if ignored { "true" } else { "false" };

    sqlx::query(
        "INSERT INTO user_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(value)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_app_ignored(
    state: State<'_, AppState>,
    app_name: String,
) -> Result<bool, String> {
    log::debug!("[CMD] get_app_ignored app_name={}", app_name);

    let key = format!("ignored_app:{}", app_name);

    let row = sqlx::query("SELECT value FROM user_preferences WHERE key = ?")
        .bind(&key)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.map(|r| r.get::<String, _>("value") == "true").unwrap_or(false))
}

/// Returns all apps the user has excluded from tracking, with their most recent total duration.
#[tauri::command]
pub async fn get_ignored_apps(
    state: State<'_, AppState>,
) -> Result<Vec<AppUsageStats>, String> {
    log::debug!("[CMD] get_ignored_apps");

    let rows = sqlx::query(
        r#"
        SELECT a.id, a.name AS app_name,
               COALESCE(SUM(u.duration), 0) AS total_duration,
               COALESCE(MAX(u.date), date('now', 'localtime')) AS latest_date
        FROM user_preferences p
        JOIN apps a ON a.name = SUBSTR(p.key, LENGTH('ignored_app:') + 1)
        LEFT JOIN app_usage u ON u.app_id = a.id
        WHERE p.key LIKE 'ignored_app:%' AND p.value = 'true'
        GROUP BY a.id
        ORDER BY a.name ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let result = rows
        .into_iter()
        .map(|row| {
            let duration: i64 = row.get("total_duration");
            let date_str: String = row.get("latest_date");
            let timestamp = chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                .ok()
                .and_then(|d| d.and_hms_opt(0, 0, 0))
                .map(|dt| dt.and_utc())
                .unwrap_or_else(|| Utc::now());
            AppUsageStats {
                id: Some(row.get("id")),
                app_name: row.get("app_name"),
                timestamp,
                duration,
                formatted_duration: format_duration(duration),
            }
        })
        .collect();

    Ok(result)
}
