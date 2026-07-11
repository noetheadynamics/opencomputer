mod db;
mod file_system;
mod git;
mod terminal;
mod updater;

use tauri::command;
use std::sync::Mutex;
use rusqlite::Connection;

#[command]
async fn send_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    icon: Option<String>,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    let mut builder = app.notification().builder().title(title).body(body);

    if let Some(icon_path) = icon {
        builder = builder.icon(icon_path);
    }

    builder.show().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize SQLite database
    let db_path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("opencomputer")
        .join("opencomputer.db");

    // Create parent directory if it doesn't exist
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn = Connection::open(&db_path).expect("Failed to open database");
    db::init_database(&conn).expect("Failed to initialize database");

    let app_state = db::AppState {
        db: Mutex::new(conn),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            file_system::list_directory,
            file_system::read_file,
            file_system::write_file,
            file_system::create_folder,
            file_system::rename_file,
            file_system::delete_file,
            file_system::move_file,
            file_system::upload_files,
            file_system::get_file_metadata,
            terminal::execute_command,
            git::git_status,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_branches,
            git::git_create_branch,
            git::git_switch_branch,
            git::git_delete_branch,
            git::git_diff,
            send_notification,
            db::get_provider_profiles,
            db::save_provider_profile,
            db::delete_provider_profile,
            db::get_app_setting,
            db::set_app_setting,
            db::delete_app_setting,
            db::get_all_app_settings,
            updater::check_for_updates,
            updater::get_current_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenComputer");
}
