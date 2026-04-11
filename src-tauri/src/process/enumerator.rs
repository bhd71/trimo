use std::{collections::HashMap, panic::AssertUnwindSafe, path::Path};

use windows::{
    core::PWSTR,
    Win32::{
        Foundation::{BOOL, HWND, LPARAM, MAX_PATH, CloseHandle},
        System::{
            ProcessStatus::K32GetModuleBaseNameW,
            Threading::{
                OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
                QueryFullProcessImageNameW,
            },
        },
        UI::WindowsAndMessaging::{EnumWindows, GetForegroundWindow, GetWindowThreadProcessId, IsWindowVisible},
    },
};

use crate::helpers::name_helper::map_helper_to_main_app;
use super::filter::is_process_safe_to_monitor;

#[derive(Debug, Clone)]
pub struct AppInfo {
    pub name: String,
    pub exe_path: Option<String>,
}

struct EnumContext {
    apps_ptr: isize,
    current_pid: u32,
    current_exe_name: String,
}

#[allow(dead_code)]
pub fn get_opened_apps_list(current_exe_name: &str) -> Vec<String> {
    get_opened_apps_with_info(current_exe_name)
        .into_iter()
        .map(|info| info.name)
        .collect()
}

pub fn get_opened_apps_with_info(current_exe_name: &str) -> Vec<AppInfo> {
    let mut apps: HashMap<String, AppInfo> = HashMap::new();
    let current_pid = std::process::id();

    unsafe {
        let apps_ptr = &mut apps as *mut _ as isize;
        let context = EnumContext {
            apps_ptr,
            current_pid,
            current_exe_name: current_exe_name.to_string(),
        };
        let context_ptr = &context as *const _ as isize;

        let _ = EnumWindows(Some(enum_window_proc_safe), LPARAM(context_ptr));
    }

    let mut result: Vec<AppInfo> = apps
        .into_values()
        .filter(|app| is_process_safe_to_monitor(&app.name, current_exe_name))
        .collect();

    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

/// Returns the name of the currently focused (foreground) application, or None if it is
/// the current process, a system process, or cannot be determined.
pub fn get_foreground_app_name(current_exe_name: &str) -> Option<String> {
    let result = std::panic::catch_unwind(AssertUnwindSafe(|| unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        if pid <= 4 || pid == std::process::id() {
            return None;
        }

        let Ok(process_handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return None;
        };

        let mut buffer = [0u16; MAX_PATH as usize];
        let mut size = MAX_PATH;

        let app_name = if QueryFullProcessImageNameW(
            process_handle,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        ).is_ok() && size > 0 {
            let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
            Path::new(&full_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default()
        } else {
            let len = K32GetModuleBaseNameW(process_handle, None, &mut buffer);
            if len > 0 {
                String::from_utf16_lossy(&buffer[..len as usize])
            } else {
                let _ = CloseHandle(process_handle);
                return None;
            }
        };

        let _ = CloseHandle(process_handle);

        if app_name.is_empty() || app_name.len() >= 260 {
            return None;
        }

        let mut name = if app_name.to_lowercase().ends_with(".exe") {
            app_name[..app_name.len() - 4].to_string()
        } else {
            app_name
        };
        name = map_helper_to_main_app(&name);

        if !is_process_safe_to_monitor(&name, current_exe_name) {
            return None;
        }

        Some(name)
    }));

    result.unwrap_or(None)
}

extern "system" fn enum_window_proc_safe(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let result = std::panic::catch_unwind(AssertUnwindSafe(|| unsafe {
        if !IsWindowVisible(hwnd).as_bool() {
            return true.into();
        }

        let context = &*(lparam.0 as *const EnumContext);
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        if pid <= 4 || pid == context.current_pid {
            return true.into();
        }

        if let Ok(process_handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            let mut buffer = [0u16; MAX_PATH as usize];
            let mut size = MAX_PATH;

            let success = QueryFullProcessImageNameW(
                process_handle,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut size,
            );

            let (exe_name, full_path) = if success.is_ok() && size > 0 {
                let full_path_str = String::from_utf16_lossy(&buffer[..size as usize]);
                let exe_name = Path::new(&full_path_str)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                (exe_name, Some(full_path_str))
            } else {
                let len = K32GetModuleBaseNameW(process_handle, None, &mut buffer);
                let exe_name = if len > 0 {
                    String::from_utf16_lossy(&buffer[..len as usize])
                } else {
                    String::new()
                };
                (exe_name, None)
            };

            let _ = CloseHandle(process_handle);

            if !exe_name.is_empty() && exe_name.len() < 260 {
                let mut app_name = if exe_name.to_lowercase().ends_with(".exe") {
                    exe_name[..exe_name.len() - 4].to_string()
                } else {
                    exe_name
                };

                app_name = map_helper_to_main_app(&app_name);

                if app_name.to_lowercase() != context.current_exe_name.to_lowercase() {
                    let apps = &mut *(context.apps_ptr as *mut HashMap<String, AppInfo>);
                    apps.insert(
                        app_name.clone(),
                        AppInfo {
                            name: app_name,
                            exe_path: full_path,
                        },
                    );
                }
            }
        }
        true.into()
    }));

    match result {
        Ok(val) => val,
        Err(_) => {
            log::error!("Panic in enum_window_proc_safe, continuing enumeration");
            true.into()
        }
    }
}
