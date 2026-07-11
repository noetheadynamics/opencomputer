use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub staged: Vec<FileStatus>,
    pub unstaged: Vec<FileStatus>,
    pub untracked: Vec<FileStatus>,
    pub ahead: i32,
    pub behind: i32,
    pub is_repo: bool,
}

#[derive(Serialize, Deserialize)]
pub struct Branch {
    pub name: String,
    pub current: bool,
}

#[derive(Serialize, Deserialize)]
pub struct CommitResult {
    pub hash: String,
    pub message: String,
}

/// Appends an operation to the Security Audit Log.
fn log_operation(app: &AppHandle, operation: &str, detail: &str, status: &str) {
    if let Ok(dir) = app.path().app_config_dir() {
        let _ = std::fs::create_dir_all(&dir);
        let log_path = dir.join("opencomputer-audit.log");
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let line = format!("{} {} {} {}\n", now, operation, status, detail);
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)
        {
            let _ = f.write_all(line.as_bytes());
        }
    }
}

fn run_git(project_root: &str, args: &[&str]) -> Result<String, String> {
    let cwd = Path::new(project_root);
    if !cwd.exists() {
        return Err(format!("Project root does not exist: {project_root}"));
    }

    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to execute git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(stderr.trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_status_line(line: &str) -> Option<(String, String, bool)> {
    if line.len() < 4 {
        return None;
    }
    let index_status = line.chars().nth(0)?;
    let worktree_status = line.chars().nth(1)?;
    let path = line[3..].trim().to_string();

    let staged = index_status != ' ' && index_status != '?';
    let status = match index_status {
        'A' => "added",
        'M' | 'm' => "modified",
        'D' | 'd' => "deleted",
        'R' => "renamed",
        '?' => "untracked",
        _ => {
            match worktree_status {
                'M' | 'm' => "modified",
                'D' | 'd' => "deleted",
                _ => "modified",
            }
        }
    };

    Some((path, status.to_string(), staged))
}

#[tauri::command]
pub fn git_status(app: AppHandle, project_root: String) -> Result<GitStatus, String> {
    log_operation(&app, "git_status", &project_root, "running");

    // Check if it's a git repo
    let check = run_git(&project_root, &["rev-parse", "--is-inside-work-tree"]);
    if check.is_err() {
        log_operation(&app, "git_status", &project_root, "not-a-repo");
        return Ok(GitStatus {
            branch: String::new(),
            staged: vec![],
            unstaged: vec![],
            untracked: vec![],
            ahead: 0,
            behind: 0,
            is_repo: false,
        });
    }

    // Get current branch
    let branch = run_git(&project_root, &["branch", "--show-current"])
        .unwrap_or_default()
        .trim()
        .to_string();

    // Get status
    let raw = run_git(&project_root, &["status", "--porcelain=v1"])?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for line in raw.lines() {
        if let Some((path, status, is_staged)) = parse_status_line(line) {
            if status == "untracked" {
                untracked.push(FileStatus {
                    path,
                    status,
                    staged: false,
                });
            } else if is_staged {
                staged.push(FileStatus {
                    path,
                    status,
                    staged: true,
                });
            } else {
                unstaged.push(FileStatus {
                    path,
                    status,
                    staged: false,
                });
            }
        }
    }

    // Get ahead/behind
    let (ahead, behind) = match run_git(
        &project_root,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    ) {
        Ok(output) => {
            let parts: Vec<&str> = output.trim().split_whitespace().collect();
            let a = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
            let b = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
            (a, b)
        }
        Err(_) => (0, 0),
    };

    log_operation(
        &app,
        "git_status",
        &format!("branch={branch} staged={} unstaged={} untracked={}", staged.len(), unstaged.len(), untracked.len()),
        "success",
    );

    Ok(GitStatus {
        branch,
        staged,
        unstaged,
        untracked,
        ahead,
        behind,
        is_repo: true,
    })
}

#[tauri::command]
pub fn git_stage(app: AppHandle, files: Vec<String>, project_root: String) -> Result<(), String> {
    log_operation(&app, "git_stage", &project_root, "running");

    if files.is_empty() {
        run_git(&project_root, &["add", "."])?;
    } else {
        let refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
        let mut args = vec!["add"];
        args.extend(refs.iter());
        run_git(&project_root, &args)?;
    }

    log_operation(&app, "git_stage", &project_root, "success");
    Ok(())
}

#[tauri::command]
pub fn git_unstage(app: AppHandle, files: Vec<String>, project_root: String) -> Result<(), String> {
    log_operation(&app, "git_unstage", &project_root, "running");

    let refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    let mut args = vec!["reset", "HEAD"];
    args.extend(refs.iter());
    run_git(&project_root, &args)?;

    log_operation(&app, "git_unstage", &project_root, "success");
    Ok(())
}

#[tauri::command]
pub fn git_commit(app: AppHandle, message: String, project_root: String) -> Result<CommitResult, String> {
    log_operation(&app, "git_commit", &message, "running");

    let output = run_git(&project_root, &["commit", "-m", &message])?;

    // Get the commit hash
    let hash = run_git(&project_root, &["rev-parse", "HEAD"])
        .unwrap_or_default()
        .trim()
        .to_string();

    log_operation(&app, "git_commit", &hash, "success");

    Ok(CommitResult {
        hash,
        message,
    })
}

#[tauri::command]
pub fn git_push(
    app: AppHandle,
    remote: String,
    branch: String,
    project_root: String,
) -> Result<String, String> {
    log_operation(&app, "git_push", &format!("{remote}/{branch}"), "running");

    let output = run_git(&project_root, &["push", &remote, &branch])?;

    log_operation(&app, "git_push", &format!("{remote}/{branch}"), "success");
    Ok(format!("Pushed to {remote}/{branch}"))
}

#[tauri::command]
pub fn git_pull(
    app: AppHandle,
    remote: String,
    branch: String,
    project_root: String,
) -> Result<String, String> {
    log_operation(&app, "git_pull", &format!("{remote}/{branch}"), "running");

    let output = run_git(&project_root, &["pull", &remote, &branch])?;

    log_operation(&app, "git_pull", &format!("{remote}/{branch}"), "success");
    Ok(output.trim().to_string())
}

#[tauri::command]
pub fn git_branches(app: AppHandle, project_root: String) -> Result<Vec<Branch>, String> {
    log_operation(&app, "git_branches", &project_root, "running");

    let output = run_git(&project_root, &["branch", "--list"])?;

    let branches = output
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            let current = trimmed.starts_with('*');
            let name = trimmed.trim_start_matches('*').trim().to_string();
            if name.is_empty() {
                return None;
            }
            Some(Branch { name, current })
        })
        .collect();

    log_operation(&app, "git_branches", &project_root, "success");
    Ok(branches)
}

#[tauri::command]
pub fn git_create_branch(app: AppHandle, name: String, project_root: String) -> Result<(), String> {
    log_operation(&app, "git_create_branch", &name, "running");
    run_git(&project_root, &["branch", &name])?;
    log_operation(&app, "git_create_branch", &name, "success");
    Ok(())
}

#[tauri::command]
pub fn git_switch_branch(app: AppHandle, name: String, project_root: String) -> Result<(), String> {
    log_operation(&app, "git_switch_branch", &name, "running");
    run_git(&project_root, &["checkout", &name])?;
    log_operation(&app, "git_switch_branch", &name, "success");
    Ok(())
}

#[tauri::command]
pub fn git_delete_branch(app: AppHandle, name: String, project_root: String) -> Result<(), String> {
    log_operation(&app, "git_delete_branch", &name, "running");
    run_git(&project_root, &["branch", "-D", &name])?;
    log_operation(&app, "git_delete_branch", &name, "success");
    Ok(())
}

#[tauri::command]
pub fn git_diff(app: AppHandle, file_path: String, project_root: String) -> Result<String, String> {
    log_operation(&app, "git_diff", &file_path, "running");
    let output = run_git(&project_root, &["diff", "--cached", "--", &file_path])?;
    log_operation(&app, "git_diff", &file_path, "success");
    Ok(output)
}
