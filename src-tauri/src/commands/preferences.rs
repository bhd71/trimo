use std::time::Duration;

use sqlx::Row;
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn get_preference(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, String> {
    log::debug!("[CMD] get_preference key={}", key);
    let db = match tokio::time::timeout(Duration::from_secs(5), state.db.lock()).await {
        Ok(db) => db,
        Err(_) => return Err("Database lock timeout".to_string()),
    };

    let row = sqlx::query("SELECT value FROM user_preferences WHERE key = ?")
        .bind(&key)
        .fetch_optional(&*db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.map(|r| r.get::<String, _>("value")))
}

#[tauri::command]
pub async fn set_preference(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    log::debug!("[CMD] set_preference key={} value={}", key, value);
    let db = match tokio::time::timeout(Duration::from_secs(5), state.db.lock()).await {
        Ok(db) => db,
        Err(_) => return Err("Database lock timeout".to_string()),
    };

    sqlx::query(
        "INSERT INTO user_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .execute(&*db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
