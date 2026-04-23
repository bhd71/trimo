use sqlx::Row;
use tauri::State;

use crate::state::{AppNotificationRule, AppState};

#[tauri::command]
pub async fn get_app_notifications(
    state: State<'_, AppState>,
) -> Result<Vec<AppNotificationRule>, String> {
    log::debug!("[CMD] get_app_notifications");

    let rows = sqlx::query(
        "SELECT id, app_name, threshold_seconds, message, enabled FROM app_notifications ORDER BY app_name ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let rules = rows
        .into_iter()
        .map(|r| AppNotificationRule {
            id: r.get("id"),
            app_name: r.get("app_name"),
            threshold_seconds: r.get("threshold_seconds"),
            message: r.get("message"),
            enabled: r.get::<i64, _>("enabled") != 0,
        })
        .collect();

    Ok(rules)
}

#[tauri::command]
pub async fn upsert_app_notification(
    state: State<'_, AppState>,
    app_name: String,
    threshold_seconds: i64,
    message: String,
    enabled: bool,
) -> Result<(), String> {
    log::debug!("[CMD] upsert_app_notification app_name={} threshold_seconds={} enabled={}", app_name, threshold_seconds, enabled);

    sqlx::query(
        r#"
        INSERT INTO app_notifications (app_name, threshold_seconds, message, enabled)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(app_name) DO UPDATE SET
            threshold_seconds = excluded.threshold_seconds,
            message           = excluded.message,
            enabled           = excluded.enabled
        "#,
    )
    .bind(&app_name)
    .bind(threshold_seconds)
    .bind(&message)
    .bind(enabled as i64)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // Reset fired state so the updated rule can fire again today
    let _ = sqlx::query("DELETE FROM notifications WHERE app_name = ?")
        .bind(&app_name)
        .execute(&state.db)
        .await;

    Ok(())
}

#[tauri::command]
pub async fn delete_app_notification(
    state: State<'_, AppState>,
    app_name: String,
) -> Result<(), String> {
    log::debug!("[CMD] delete_app_notification app_name={}", app_name);

    sqlx::query("DELETE FROM app_notifications WHERE app_name = ?")
        .bind(&app_name)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let _ = sqlx::query("DELETE FROM notifications WHERE app_name = ?")
        .bind(&app_name)
        .execute(&state.db)
        .await;

    Ok(())
}
