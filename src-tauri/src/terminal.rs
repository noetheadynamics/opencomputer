use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Serialize, Deserialize)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub timed_out: bool,
}

/// Commands denied by default (Critical Rule 3).
const NETWORK_COMMANDS: &[&str] = &["curl", "wget", "nc", "telnet", "ssh"];

fn classify_risk(command: &str) -> (String, String) {
    let trimmed = command.trim();
    let base = trimmed.split_whitespace().next().unwrap_or("");
    let base_name = base.rsplit('/').next().unwrap_or(base);

    if NETWORK_COMMANDS.contains(&base_name) {
        return (
            "high".to_string(),
            format!("Network command \"{base_name}\" is blocked by default."),
        );
    }

    let high_patterns = ["rm -rf", "sudo", "chmod 777", "mkfs", "dd ", "format", "shutdown", "reboot"];
    for pattern in &high_patterns {
        if trimmed.contains(pattern) {
            return (
                "high".to_string(),
                format!("Dangerous pattern detected: {pattern}"),
            );
        }
    }

    let medium_patterns = ["rm ", "mv ", "chmod", "chown", "kill", "pkill", "su "];
    for pattern in &medium_patterns {
        if trimmed.contains(pattern) {
            return (
                "medium".to_string(),
                format!("Moderate risk command: {pattern}"),
            );
        }
    }

    ("low".to_string(), "Standard command".to_string())
}

/// Appends an operation to the Security Audit Log.
fn log_operation(app: &AppHandle, operation: &str, command: &str, status: &str) {
    if let Ok(dir) = app.path().app_config_dir() {
        let _ = std::fs::create_dir_all(&dir);
        let log_path = dir.join("opencomputer-audit.log");
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let line = format!("{} {} {} {}\n", now, operation, status, command);
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)
        {
            let _ = f.write_all(line.as_bytes());
        }
    }
}

#[tauri::command]
pub fn execute_command(
    app: AppHandle,
    command: String,
    project_root: String,
) -> Result<CommandOutput, String> {
    let (risk_level, _reason) = classify_risk(&command);

    // Block network commands at backend level
    if risk_level == "high" {
        let base = command.trim().split_whitespace().next().unwrap_or("");
        let base_name = base.rsplit('/').next().unwrap_or(base);
        if NETWORK_COMMANDS.contains(&base_name) {
            log_operation(&app, "execute_command", &command, "blocked");
            return Err(format!(
                "Command blocked: network command \"{base_name}\" is not allowed."
            ));
        }
    }

    let cwd = Path::new(&project_root);
    if !cwd.exists() {
        return Err(format!("Project root does not exist: {project_root}"));
    }

    log_operation(&app, "execute_command", &command, "running");

    let output = Command::new("sh")
        .arg("-c")
        .arg(&command)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to execute command: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    log_operation(
        &app,
        "execute_command",
        &command,
        if exit_code == 0 { "success" } else { "error" },
    );

    Ok(CommandOutput {
        stdout,
        stderr,
        exit_code,
        timed_out: false,
    })
}
