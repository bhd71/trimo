/// Maps helper processes to their main application names
/// This helps consolidate processes like "steamwebhelper" -> "steam"
pub fn map_helper_to_main_app(process_name: &str) -> String {
    let name_lower = process_name.to_lowercase();

    // Steam processes
    if name_lower.starts_with("steam") && !name_lower.eq("steam") {
        return "Steam".to_string();
    }

    // Chrome processes
    if name_lower.contains("chrome") || name_lower == "googlechromehelper" {
        return "Chrome".to_string();
    }

    // Firefox processes
    if name_lower.contains("firefox") {
        return "Firefox".to_string();
    }

    // Edge processes
    if name_lower.contains("msedge") || name_lower.contains("edge") {
        return "Edge".to_string();
    }

    // Discord processes
    if name_lower.starts_with("discord") && !name_lower.eq("discord") {
        return "Discord".to_string();
    }

    // Spotify processes
    if name_lower.starts_with("spotify") && !name_lower.eq("spotify") {
        return "Spotify".to_string();
    }

    // VS Code
    if name_lower == "code" {
        return "VS Code".to_string();
    }

    // VS Code processes
    if name_lower.contains("code") && (name_lower.contains("helper") || name_lower.contains("renderer")) {
        return "VS Code".to_string();
    }

    // Electron apps - try to extract main app name
    if name_lower.ends_with("helper") || name_lower.ends_with("renderer") || name_lower.ends_with("gpu") {
        // Try to extract the main app name by removing common suffixes
        let suffixes = ["helper", "renderer", "gpu", "utility", "crashpad", "handler"];
        let mut main_name = name_lower.clone();

        for suffix in &suffixes {
            if main_name.ends_with(suffix) {
                main_name = main_name.trim_end_matches(suffix).trim_end_matches("_").trim_end_matches("-").to_string();
                break;
            }
        }

        if !main_name.is_empty() && main_name != name_lower {
            // Capitalize first letter
            return main_name.chars().next().unwrap().to_uppercase().chain(main_name.chars().skip(1)).collect();
        }
    }

    // Return original name with proper capitalization
    if process_name.chars().next().unwrap().is_lowercase() {
        process_name.chars().next().unwrap().to_uppercase().chain(process_name.chars().skip(1)).collect()
    } else {
        process_name.to_string()
    }
}

/// Determines whether a process should be skipped from tracking
/// This filters out system processes, background services, etc.
pub fn should_skip_process(app_name: &str) -> bool {
    let skip_list = [
        // System processes
        "dwm",
        "winlogon",
        "csrss",
        "smss",
        "wininit",
        "services",
        "lsass",
        "svchost",
        "explorer",
        "SearchUI",
        "ShellExperienceHost",
        "StartMenuExperienceHost",
        "RuntimeBroker",
        "ApplicationFrameHost",
        "SystemSettings",
        "WinStore.App",
        "Calculator",
        "backgroundTaskHost",
        "TabletInputHost",
        "TextInputHost",

        // Browser helper processes
        // "chrome",
        "firefox",
        "edge",
        "msedge",
        "brave",

        // Development tools that shouldn't be tracked
        "devenv",
        "cargo",
        "rustc",
        "cmd",
        "powershell",
        "WindowsTerminal",

        // CRITICAL: Add your Tauri app executable name here
        "tauri-app",      // ← Your actual app name from tauri.conf.json
        "Trimo",          // ← Your window title from tauri.conf.json
        "tauri",
        "app",

        // Add more helper processes as needed
    ];

    let app_lower = app_name.to_lowercase();

    // Check exact matches
    if skip_list.iter().any(|&skip| app_lower == skip.to_lowercase()) {
        return true;
    }

    // Check if it contains certain patterns that indicate helper processes
    let helper_patterns = [
        "helper",
        "renderer",
        "gpu-process",
        "crashpad",
        "update",
        "installer",
    ];

    helper_patterns.iter().any(|&pattern| app_lower.contains(pattern))
}


/// Helper function to format duration from seconds to human-readable format
pub fn format_duration(seconds: i64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, secs)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, secs)
    } else {
        format!("{}s", secs)
    }
}
