//! Auto-update logic for OpenComputer.
//! Checks GitHub releases for new versions, downloads platform-specific
//! installers, and runs them silently.

use serde::{Deserialize, Serialize};
use std::io::Write;
use tauri::{command, AppHandle, Emitter};
use semver::Version;

/// Update information returned by the check.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    pub url: String,
    pub download_url: String,
    pub release_notes: Option<String>,
}

/// Get the current application version.
#[command]
pub fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Detect the current platform.
#[command]
pub fn get_platform() -> String {
    if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macos".to_string()
    } else {
        "linux".to_string()
    }
}

/// Check for updates from GitHub releases.
/// Compares semver and finds the platform-specific download URL.
#[command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let client = reqwest::Client::new();
    let current_version_str = env!("CARGO_PKG_VERSION");

    let current_version = Version::parse(current_version_str)
        .map_err(|e| format!("Failed to parse current version: {}", e))?;

    let response = client
        .get("https://api.github.com/repos/noethea-dynamics/opencomputer/releases/latest")
        .header("User-Agent", "OpenComputer-Updater")
        .send()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    if !response.status().is_success() {
        return Ok(UpdateInfo {
            available: false,
            version: current_version_str.to_string(),
            url: String::new(),
            download_url: String::new(),
            release_notes: None,
        });
    }

    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;

    let latest_version_str = release["tag_name"]
        .as_str()
        .unwrap_or(current_version_str)
        .trim_start_matches('v');

    let latest_version = Version::parse(latest_version_str)
        .unwrap_or_else(|_| current_version.clone());

    let html_url = release["html_url"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let body = release["body"]
        .as_str()
        .map(|s| s.to_string());

    // Find platform-specific asset
    let platform = get_platform();
    let download_url = find_platform_asset(&release, &platform);

    let available = latest_version > current_version;

    Ok(UpdateInfo {
        available,
        version: latest_version_str.to_string(),
        url: html_url,
        download_url,
        release_notes: body,
    })
}

/// Find the download URL for the current platform from release assets.
fn find_platform_asset(release: &serde_json::Value, platform: &str) -> String {
    let assets = match release["assets"].as_array() {
        Some(a) => a,
        None => return String::new(),
    };

    let patterns: Vec<&str> = match platform {
        "windows" => vec![".msi", ".exe"],
        "macos" => vec![".dmg"],
        "linux" => vec![".deb", ".AppImage"],
        _ => vec![],
    };

    for asset in assets {
        let name = asset["name"].as_str().unwrap_or("").to_lowercase();
        let url = asset["browser_download_url"].as_str().unwrap_or("");

        for pattern in &patterns {
            if name.contains(pattern) {
                return url.to_string();
            }
        }
    }

    String::new()
}

/// Download and silently install an update.
/// Emits progress events as `update-progress` with { percent, status }.
#[command]
pub async fn download_and_install_update(
    app: AppHandle,
    download_url: String,
) -> Result<String, String> {
    if download_url.is_empty() {
        return Err("No download URL provided".to_string());
    }

    let platform = get_platform();

    // Emit: starting download
    let _ = app.emit("update-progress", serde_json::json!({
        "percent": 0,
        "status": "Downloading update..."
    }));

    // Download the installer
    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .header("User-Agent", "OpenComputer-Updater")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);

    // Determine file extension from URL
    let ext = download_url
        .rsplit('.')
        .next()
        .unwrap_or("bin")
        .split('?')
        .next()
        .unwrap_or("bin");

    // Create temp directory
    let temp_dir = std::env::temp_dir().join("opencomputer-update");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let installer_path = temp_dir.join(format!("update.{}", ext));

    // Download with progress
    let mut file = std::fs::File::create(&installer_path)
        .map_err(|e| format!("Failed to create installer file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = ((downloaded as f64 / total_size as f64) * 100.0) as u32;
            let _ = app.emit("update-progress", serde_json::json!({
                "percent": percent,
                "status": format!("Downloading... {}%", percent)
            }));
        }
    }

    drop(file);

    // Emit: installing
    let _ = app.emit("update-progress", serde_json::json!({
        "percent": 100,
        "status": "Installing update..."
    }));

    // Run silent install based on platform
    match platform.as_str() {
        "windows" => install_windows(&installer_path).await?,
        "macos" => install_macos(&installer_path).await?,
        "linux" => install_linux(&installer_path).await?,
        _ => return Err(format!("Unsupported platform: {}", platform)),
    }

    // Emit: complete
    let _ = app.emit("update-progress", serde_json::json!({
        "percent": 100,
        "status": "Update installed — restart to apply"
    }));

    // Clean up temp files
    let _ = std::fs::remove_dir_all(&temp_dir);

    Ok("Update installed successfully".to_string())
}

/// Silent install on Windows using msiexec.
async fn install_windows(installer_path: &std::path::Path) -> Result<(), String> {
    let status = std::process::Command::new("msiexec")
        .args([
            "/i",
            installer_path.to_str().unwrap_or(""),
            "/quiet",
            "/norestart",
        ])
        .status()
        .map_err(|e| format!("Failed to run installer: {}", e))?;

    if !status.success() {
        return Err(format!("Installer exited with code: {}", status));
    }

    Ok(())
}

/// Silent install on macOS: mount DMG and copy app to /Applications.
async fn install_macos(installer_path: &std::path::Path) -> Result<(), String> {
    // Mount the DMG
    let mount_output = std::process::Command::new("hdiutil")
        .args([
            "attach",
            installer_path.to_str().unwrap_or(""),
            "-nobrowse",
            "-quiet",
        ])
        .output()
        .map_err(|e| format!("Failed to mount DMG: {}", e))?;

    if !mount_output.status.success() {
        return Err(format!("Failed to mount DMG: {}", String::from_utf8_lossy(&mount_output.stderr)));
    }

    // Find the mount point from diskutil output
    let mount_output_str = String::from_utf8_lossy(&mount_output.stdout);
    let mount_point = mount_output_str
        .lines()
        .find(|line| line.contains("/Volumes/"))
        .and_then(|line| line.split_whitespace().last())
        .unwrap_or("")
        .to_string();

    if mount_point.is_empty() {
        return Err("Could not find mount point".to_string());
    }

    // Find the .app bundle in the mounted volume
    let entries = std::fs::read_dir(&mount_point)
        .map_err(|e| format!("Failed to read mount point: {}", e))?;

    let app_name = entries
        .filter_map(|e| e.ok())
        .find(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "app")
                .unwrap_or(false)
        })
        .map(|e| e.path())
        .ok_or_else(|| "No .app bundle found in DMG".to_string())?;

    // Copy to /Applications
    let status = std::process::Command::new("cp")
        .args([
            "-R",
            app_name.to_str().unwrap_or(""),
            "/Applications/",
        ])
        .status()
        .map_err(|e| format!("Failed to copy app: {}", e))?;

    if !status.success() {
        return Err("Failed to copy app to /Applications".to_string());
    }

    // Unmount
    let _ = std::process::Command::new("hdiutil")
        .args(["detach", &mount_point, "-quiet"])
        .status();

    Ok(())
}

/// Silent install on Linux using dpkg for .deb.
async fn install_linux(installer_path: &std::path::Path) -> Result<(), String> {
    let ext = installer_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match ext {
        "deb" => {
            let status = std::process::Command::new("pkexec")
                .args([
                    "dpkg",
                    "-i",
                    installer_path.to_str().unwrap_or(""),
                ])
                .status()
                .map_err(|e| format!("Failed to run dpkg: {}", e))?;

            if !status.success() {
                return Err(format!("dpkg exited with code: {}", status));
            }
        }
        "AppImage" => {
            let status = std::process::Command::new(installer_path)
                .args(["--appimage-extract-and-run"])
                .status()
                .map_err(|e| format!("Failed to run AppImage: {}", e))?;

            if !status.success() {
                return Err(format!("AppImage exited with code: {}", status));
            }
        }
        _ => {
            return Err(format!("Unsupported Linux installer format: {}", ext));
        }
    }

    Ok(())
}
