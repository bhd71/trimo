use base64::{engine::general_purpose, Engine as _};

pub fn create_placeholder_logo(app_name: &str) -> String {
    let color = "#4a90e2";
    let first_char = app_name.chars().next().unwrap_or('A').to_uppercase();

    let svg = format!(
        r#"<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" fill="{}" rx="4"/>
        <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial" font-size="12">
            {}
        </text>
    </svg>"#,
        color, first_char
    );

    general_purpose::STANDARD.encode(svg.as_bytes())
}
