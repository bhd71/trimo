use tauri_app_lib::helpers::name_helper::{format_duration, map_helper_to_main_app, should_skip_process};

// --- map_helper_to_main_app ---

#[test]
fn steam_helper_maps_to_steam() {
    assert_eq!(map_helper_to_main_app("steamwebhelper"), "Steam");
    assert_eq!(map_helper_to_main_app("steamservice"), "Steam");
}

#[test]
fn steam_itself_is_unchanged() {
    assert_eq!(map_helper_to_main_app("steam"), "Steam"); // capitalised by fallback
}

#[test]
fn chrome_variants_map_to_chrome() {
    assert_eq!(map_helper_to_main_app("chrome"), "Chrome");
    assert_eq!(map_helper_to_main_app("googlechromehelper"), "Chrome");
}

#[test]
fn firefox_maps_to_firefox() {
    assert_eq!(map_helper_to_main_app("firefox"), "Firefox");
    assert_eq!(map_helper_to_main_app("firefox-bin"), "Firefox");
}

#[test]
fn edge_variants_map_to_edge() {
    assert_eq!(map_helper_to_main_app("msedge"), "Edge");
    assert_eq!(map_helper_to_main_app("microsoftedge"), "Edge");
}

#[test]
fn discord_helper_maps_to_discord() {
    assert_eq!(map_helper_to_main_app("discordptb"), "Discord");
    assert_eq!(map_helper_to_main_app("discordcanary"), "Discord");
}

#[test]
fn discord_itself_is_unchanged() {
    assert_eq!(map_helper_to_main_app("discord"), "Discord");
}

#[test]
fn spotify_helper_maps_to_spotify() {
    assert_eq!(map_helper_to_main_app("spotifyhelper"), "Spotify");
}

#[test]
fn code_maps_to_vscode() {
    assert_eq!(map_helper_to_main_app("code"), "VS Code");
}

#[test]
fn unknown_process_is_capitalised() {
    assert_eq!(map_helper_to_main_app("notepad"), "Notepad");
    assert_eq!(map_helper_to_main_app("Notepad"), "Notepad");
}

// --- should_skip_process ---

#[test]
fn system_processes_are_skipped() {
    assert!(should_skip_process("dwm"));
    assert!(should_skip_process("svchost"));
    assert!(should_skip_process("explorer"));
    assert!(should_skip_process("winlogon"));
}

#[test]
fn shell_process_is_skipped() {
    assert!(should_skip_process("powershell"));
    assert!(should_skip_process("cmd"));
}

#[test]
fn tauri_app_is_skipped() {
    assert!(should_skip_process("tauri-app"));
}

#[test]
fn user_apps_are_not_skipped() {
    assert!(!should_skip_process("Notepad"));
    assert!(!should_skip_process("vlc"));
    assert!(!should_skip_process("slack"));
}

#[test]
fn helper_pattern_is_skipped() {
    assert!(should_skip_process("someapp-helper"));
    assert!(should_skip_process("crashpad_handler"));
}

// --- format_duration ---

#[test]
fn format_duration_seconds_only() {
    assert_eq!(format_duration(45), "45s");
}

#[test]
fn format_duration_minutes_and_seconds() {
    assert_eq!(format_duration(90), "1m 30s");
}

#[test]
fn format_duration_hours_minutes_seconds() {
    assert_eq!(format_duration(3661), "1h 1m 1s");
}
