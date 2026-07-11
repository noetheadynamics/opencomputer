//! Auto-update logic for OpenComputer.

use serde::{Deserialize, Serialize};
use tauri::command;

/// Update information returned by the check.
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    pub url: String,
    pub release_notes: Option<String>,
}

/// Check for updates from GitHub releases.
#[command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let client = reqwest::Client::new();
    
    // Get current version from Cargo.toml
    let current_version = env!("CARGO_PKG_VERSION");
    
    // Fetch latest release from GitHub API
    let response = client
        .get("https://api.github.com/repos/noethea-dynamics/opencomputer/releases/latest")
        .header("User-Agent", "OpenComputer-Updater")
        .send()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;
    
    if !response.status().is_success() {
        return Ok(UpdateInfo {
            available: false,
            version: current_version.to_string(),
            url: String::new(),
            release_notes: None,
        });
    }
    
    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;
    
    let latest_version = release["tag_name"]
        .as_str()
        .unwrap_or(current_version)
        .trim_start_matches('v');
    
    let html_url = release["html_url"]
        .as_str()
        .unwrap_or("")
        .to_string();
    
    let body = release["body"]
        .as_str()
        .map(|s| s.to_string());
    
    // Compare versions (simple string comparison for now)
    let available = latest_version != current_version;
    
    Ok(UpdateInfo {
        available,
        version: latest_version.to_string(),
        url: html_url,
        release_notes: body,
    })
}

/// Get the current application version.
#[command]
pub fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
