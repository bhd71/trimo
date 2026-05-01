pub mod helpers;
mod state;
mod db;
pub mod process;
mod logo;
mod commands;

use std::sync::Arc;

use sqlx::{Row, sqlite::SqlitePool};
use state::{AppState, new_logo_cache};
use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tokio::sync::Mutex;

async fn read_monitoring_interval(db: &SqlitePool) -> u64 {
    sqlx::query("SELECT value FROM user_preferences WHERE key = 'monitoring_interval'")
        .fetch_optional(db)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.get::<String, _>("value").parse::<u64>().ok())
        .unwrap_or(5)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
    env_logger::init();
    log::info!("Starting Tauri application safely...");

    let db = db::connect().await;
    db::setup_database(&db).await;

    let monitoring_interval = read_monitoring_interval(&db).await;
    log::info!("Saved monitoring interval: {}s", monitoring_interval);

    let current_exe_name = process::get_current_exe_name();
    log::info!("Current executable name: {}", current_exe_name);

    let app_state = AppState {
        db,
        monitoring_task: Arc::new(Mutex::new(None)),
        logo_cache: Arc::new(Mutex::new(new_logo_cache())),
        active_apps: Arc::new(Mutex::new(Vec::new())),
        current_exe_name,
        focus_app: Arc::new(Mutex::new(None)),
        last_external_focus: Arc::new(Mutex::new(None)),
    };

    log::info!("Application state initialized");

    match tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Second instance launched — focus the existing window
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::apps::list_opened_apps,
            commands::apps::get_focused_app,
            commands::monitoring::toggle_monitoring,
            commands::monitoring::get_monitoring_status,
            commands::monitoring::apply_monitoring_interval,
            commands::usage::get_app_usage_history,
            commands::usage::get_app_usage_stats,
            commands::usage::get_total_monitoring_time,
            commands::usage::get_app_daily_usage,
            commands::usage::get_monitoring_trend,
            commands::usage::get_dashboard_data,
            commands::usage::get_app_logo,
            commands::preferences::get_preference,
            commands::preferences::set_preference,
            commands::notifications::get_app_notifications,
            commands::notifications::upsert_app_notification,
            commands::notifications::delete_app_notification,
            commands::ignored::set_app_ignored,
            commands::ignored::get_app_ignored,
            commands::ignored::get_ignored_apps,
        ])
        .setup(move |app| {
            // Auto-start monitoring with persisted interval
            let state = app.state::<AppState>();
            let db = state.db.clone();
            let logo_cache = state.logo_cache.clone();
            let current_exe_name = state.current_exe_name.clone();
            let task = state.monitoring_task.clone();
            let focus_app = state.focus_app.clone();
            let last_external_focus = state.last_external_focus.clone();
            let app_handle = app.handle().clone();

            let active_apps = state.active_apps.clone();
            tauri::async_runtime::spawn(async move {
                commands::monitoring::start_monitoring_inner(
                    db,
                    logo_cache,
                    active_apps,
                    current_exe_name,
                    task,
                    monitoring_interval,
                    app_handle,
                    focus_app,
                    last_external_focus,
                )
                .await;
            });

            // System tray
            let show = MenuItem::with_id(app, "show", "Show Trimo", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Trimo — tracking active")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            log::info!("Tauri app setup completed");
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
    {
        Ok(_) => log::info!("Application exited normally"),
        Err(e) => {
            log::error!("Error running Tauri application: {}", e);
            std::process::exit(1);
        }
    }
}

