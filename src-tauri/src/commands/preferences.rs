use sqlx::Row;
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn get_preference(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, String> {
    log::debug!("[CMD] get_preference key={}", key);

    let row = sqlx::query("SELECT value FROM user_preferences WHERE key = ?")
        .bind(&key)
        .fetch_optional(&state.db)
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

    sqlx::query(
        "INSERT INTO user_preferences (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
