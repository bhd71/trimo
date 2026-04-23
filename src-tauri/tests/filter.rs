use tauri_app_lib::process::is_process_safe_to_monitor;

#[test]
fn self_process_is_not_safe() {
    assert!(!is_process_safe_to_monitor("myapp", "myapp"));
}

#[test]
fn self_process_check_is_case_insensitive() {
    assert!(!is_process_safe_to_monitor("MyApp", "myapp"));
    assert!(!is_process_safe_to_monitor("myapp", "MyApp"));
}

#[test]
fn known_app_variants_are_not_safe() {
    assert!(!is_process_safe_to_monitor("tauri-app", "something_else"));
    assert!(!is_process_safe_to_monitor("trimo", "something_else"));
    assert!(!is_process_safe_to_monitor("tauri_app_lib", "something_else"));
}

#[test]
fn system_process_is_not_safe() {
    assert!(!is_process_safe_to_monitor("svchost", "myapp"));
    assert!(!is_process_safe_to_monitor("dwm", "myapp"));
}

#[test]
fn normal_user_app_is_safe() {
    assert!(is_process_safe_to_monitor("Notepad", "myapp"));
    assert!(is_process_safe_to_monitor("vlc", "myapp"));
    assert!(is_process_safe_to_monitor("slack", "myapp"));
}
