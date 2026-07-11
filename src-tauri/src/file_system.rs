use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: i64,
}

#[derive(Serialize, Deserialize)]
pub struct FileMetadata {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: i64,
}

#[derive(Serialize, Deserialize)]
pub struct UploadFile {
    pub name: String,
    pub content: String,
}

/// Resolves `path` against `project_root` and ensures it stays inside the root.
/// Rejects any path containing `..` or that escapes the root directory.
fn resolve_safe_path(path: &str, project_root: &str) -> Result<PathBuf, String> {
    if path.contains("..") {
        return Err("Path traversal detected".to_string());
    }
    let root = PathBuf::from(project_root)
        .canonicalize()
        .map_err(|e| format!("Invalid project root: {e}"))?;

    let candidate = if Path::new(path).is_absolute() {
        PathBuf::from(path)
    } else {
        root.join(path)
    };

    let canonical = candidate.canonicalize().unwrap_or_else(|_| candidate.clone());
    if !canonical.starts_with(&root) {
        return Err("Path traversal detected".to_string());
    }
    Ok(candidate)
}

fn modified_ms(meta: &fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Appends an operation to the Security Audit Log (Phase 6 consumer).
fn log_operation(app: &AppHandle, operation: &str, path: &str, status: &str) {
    if let Ok(dir) = app.path().app_config_dir() {
        let _ = fs::create_dir_all(&dir);
        let log_path = dir.join("opencomputer-audit.log");
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let line = format!("{} {} {} {}\n", now, operation, status, path);
        if let Ok(mut f) = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)
        {
            let _ = f.write_all(line.as_bytes());
        }
    }
}

#[tauri::command]
pub fn list_directory(
    app: AppHandle,
    path: String,
    project_root: String,
) -> Result<Vec<FileEntry>, String> {
    let full = resolve_safe_path(&path, &project_root)?;
    let read = fs::read_dir(&full).map_err(|e| format!("Cannot read directory: {e}"))?;
    let mut entries: Vec<FileEntry> = Vec::new();
    for entry in read.flatten() {
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let is_dir = meta.is_dir();
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            size: if is_dir { 0 } else { meta.len() },
            modified: modified_ms(&meta),
        });
    }
    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return a.is_dir.cmp(&b.is_dir).reverse();
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    log_operation(&app, "list_directory", &path, "success");
    Ok(entries)
}

#[tauri::command]
pub fn read_file(
    app: AppHandle,
    path: String,
    project_root: String,
) -> Result<String, String> {
    let full = resolve_safe_path(&path, &project_root)?;
    let content = fs::read_to_string(&full).map_err(|e| format!("Cannot read file: {e}"))?;
    log_operation(&app, "read_file", &path, "success");
    Ok(content)
}

#[tauri::command]
pub fn write_file(
    app: AppHandle,
    path: String,
    content: String,
    project_root: String,
) -> Result<(), String> {
    let full = resolve_safe_path(&path, &project_root)?;
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create parent: {e}"))?;
    }
    fs::write(&full, content).map_err(|e| format!("Cannot write file: {e}"))?;
    log_operation(&app, "write_file", &path, "success");
    Ok(())
}

#[tauri::command]
pub fn create_folder(
    app: AppHandle,
    path: String,
    project_root: String,
) -> Result<(), String> {
    let full = resolve_safe_path(&path, &project_root)?;
    fs::create_dir_all(&full).map_err(|e| format!("Cannot create folder: {e}"))?;
    log_operation(&app, "create_folder", &path, "success");
    Ok(())
}

#[tauri::command]
pub fn rename_file(
    app: AppHandle,
    old_path: String,
    new_path: String,
    project_root: String,
) -> Result<(), String> {
    let src = resolve_safe_path(&old_path, &project_root)?;
    let dst = resolve_safe_path(&new_path, &project_root)?;
    fs::rename(&src, &dst).map_err(|e| format!("Cannot rename: {e}"))?;
    log_operation(&app, "rename_file", &old_path, "success");
    Ok(())
}

#[tauri::command]
pub fn delete_file(
    app: AppHandle,
    path: String,
    project_root: String,
) -> Result<(), String> {
    let full = resolve_safe_path(&path, &project_root)?;
    let result = if full.is_dir() {
        fs::remove_dir_all(&full)
    } else {
        fs::remove_file(&full)
    };
    result.map_err(|e| format!("Cannot delete: {e}"))?;
    log_operation(&app, "delete_file", &path, "success");
    Ok(())
}

#[tauri::command]
pub fn move_file(
    app: AppHandle,
    source: String,
    destination: String,
    project_root: String,
) -> Result<(), String> {
    let src = resolve_safe_path(&source, &project_root)?;
    let dst = resolve_safe_path(&destination, &project_root)?;
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create parent: {e}"))?;
    }
    fs::rename(&src, &dst).map_err(|e| format!("Cannot move: {e}"))?;
    log_operation(&app, "move_file", &source, "success");
    Ok(())
}

#[tauri::command]
pub fn upload_files(
    app: AppHandle,
    files: Vec<UploadFile>,
    target_dir: String,
    project_root: String,
) -> Result<(), String> {
    let dir = resolve_safe_path(&target_dir, &project_root)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create target: {e}"))?;
    for f in files {
        let dest = dir.join(&f.name);
        if !dest.starts_with(&dir) {
            return Err("Path traversal detected".to_string());
        }
        fs::write(&dest, f.content).map_err(|e| format!("Cannot write upload: {e}"))?;
    }
    log_operation(&app, "upload_files", &target_dir, "success");
    Ok(())
}

#[tauri::command]
pub fn get_file_metadata(
    app: AppHandle,
    path: String,
    project_root: String,
) -> Result<FileMetadata, String> {
    let full = resolve_safe_path(&path, &project_root)?;
    let meta = fs::metadata(&full).map_err(|e| format!("Cannot stat: {e}"))?;
    let is_dir = meta.is_dir();
    let result = FileMetadata {
        name: full
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        path: full.to_string_lossy().to_string(),
        is_dir,
        size: if is_dir { 0 } else { meta.len() },
        modified: modified_ms(&meta),
    };
    log_operation(&app, "get_file_metadata", &path, "success");
    Ok(result)
}
