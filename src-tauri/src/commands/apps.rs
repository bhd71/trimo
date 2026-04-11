use tauri::State;

use crate::state::AppState;

/// Returns the active app list cached by the last monitoring cycle.
/// No Win32 enumeration — the monitoring loop already does that every tick.
#[tauri::command]
pub async fn list_opened_apps(state: State<'_, AppState>) -> Result<Vec<String>, ()> {
    log::debug!("[CMD] list_opened_apps");
    Ok(state.active_apps.lock().await.clone())
}

/// Returns the name of the currently focused application as tracked by the last monitoring cycle.
#[tauri::command]
pub async fn get_focused_app(state: State<'_, AppState>) -> Result<Option<String>, ()> {
    log::debug!("[CMD] get_focused_app");
    Ok(state.focus_app.lock().await.clone())
}
