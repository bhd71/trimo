enum MatchKind {
    /// Process name is exactly this value (case-insensitive)
    Exact,
    /// Process name starts with the pattern but is not identical to it
    PrefixNotExact,
    /// Process name contains the pattern as a substring
    Contains,
    /// Process name contains the primary pattern AND a secondary substring
    ContainsTwo(&'static str),
}

struct ProcessRule {
    kind: MatchKind,
    pattern: &'static str,
    name: &'static str,
}

/// Ordered rules evaluated top-to-bottom; first match wins.
/// To add a new app, insert a rule here — no logic changes needed.
const PROCESS_RULES: &[ProcessRule] = &[
    // Exact overrides
    ProcessRule { kind: MatchKind::Exact,         pattern: "googlechromehelper", name: "Chrome" },
    ProcessRule { kind: MatchKind::Exact,         pattern: "code",              name: "VS Code" },
    // Prefix-based helpers (steamwebhelper → Steam, but "steam" itself falls through)
    ProcessRule { kind: MatchKind::PrefixNotExact, pattern: "steam",   name: "Steam" },
    ProcessRule { kind: MatchKind::PrefixNotExact, pattern: "discord", name: "Discord" },
    ProcessRule { kind: MatchKind::PrefixNotExact, pattern: "spotify", name: "Spotify" },
    // Substring-based
    ProcessRule { kind: MatchKind::Contains, pattern: "chrome",  name: "Chrome" },
    ProcessRule { kind: MatchKind::Contains, pattern: "firefox", name: "Firefox" },
    ProcessRule { kind: MatchKind::Contains, pattern: "msedge",  name: "Edge" },
    ProcessRule { kind: MatchKind::Contains, pattern: "edge",    name: "Edge" },
    // VS Code helper/renderer processes (e.g. codehelper, coderenderer)
    ProcessRule { kind: MatchKind::ContainsTwo("helper"),   pattern: "code", name: "VS Code" },
    ProcessRule { kind: MatchKind::ContainsTwo("renderer"), pattern: "code", name: "VS Code" },
];

/// Maps helper processes to their main application names
/// This helps consolidate processes like "steamwebhelper" -> "steam"
pub fn map_helper_to_main_app(process_name: &str) -> String {
    let name_lower = process_name.to_lowercase();

    for rule in PROCESS_RULES {
        let matched = match rule.kind {
            MatchKind::Exact          => name_lower == rule.pattern,
            MatchKind::PrefixNotExact => name_lower.starts_with(rule.pattern) && name_lower != rule.pattern,
            MatchKind::Contains       => name_lower.contains(rule.pattern),
            MatchKind::ContainsTwo(b) => name_lower.contains(rule.pattern) && name_lower.contains(b),
        };
        if matched {
            return rule.name.to_string();
        }
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
        format!("{}h {}m", hours, minutes)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, secs)
    } else {
        format!("{}s", secs)
    }
}
