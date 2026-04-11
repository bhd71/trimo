use std::env;

use crate::helpers::name_helper::should_skip_process;

pub fn get_current_exe_name() -> String {
    env::current_exe()
        .ok()
        .and_then(|path| {
            path.file_stem()
                .map(|stem| stem.to_string_lossy().to_lowercase())
        })
        .map(|name| {
            if name.ends_with(".exe") {
                name[..name.len() - 4].to_string()
            } else {
                name
            }
        })
        .unwrap_or_else(|| "tauri-app".to_string())
}

pub fn is_process_safe_to_monitor(app_name: &str, current_exe_name: &str) -> bool {
    let app_lower = app_name.to_lowercase();
    let current_lower = current_exe_name.to_lowercase();

    if app_lower == current_lower {
        log::debug!("Skipping self-process: {}", app_name);
        return false;
    }

    let our_app_variations = ["tauri-app", "trimo", "tauri_app_lib"];
    for variant in &our_app_variations {
        if app_lower == variant.to_lowercase() {
            log::debug!("Skipping app variant: {}", app_name);
            return false;
        }
    }

    if should_skip_process(app_name) {
        log::debug!("Skipping filtered process: {}", app_name);
        return false;
    }

    true
}
