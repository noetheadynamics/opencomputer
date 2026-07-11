//! SQLite database operations for OpenComputer persistent storage.

use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Application state holding the database connection.
pub struct AppState {
    pub db: Mutex<Connection>,
}

/// Provider profile stored in SQLite.
#[derive(Debug, Serialize, Deserialize)]
pub struct ProviderProfile {
    pub id: String,
    pub label: String,
    pub base_url: String,
    pub api_key: Option<String>,
    pub model_name: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Application setting stored in SQLite.
#[derive(Debug, Serialize, Deserialize)]
pub struct AppSetting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

/// Initialize the SQLite database schema.
pub fn init_database(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS provider_profiles (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT,
            model_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        ",
    )?;
    Ok(())
}

/// Get all provider profiles from the database.
#[tauri::command]
pub fn get_provider_profiles(state: State<AppState>) -> Result<Vec<ProviderProfile>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, label, base_url, api_key, model_name, created_at, updated_at FROM provider_profiles")
        .map_err(|e| e.to_string())?;

    let profiles = stmt
        .query_map([], |row| {
            Ok(ProviderProfile {
                id: row.get(0)?,
                label: row.get(1)?,
                base_url: row.get(2)?,
                api_key: row.get(3)?,
                model_name: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(profiles)
}

/// Save a provider profile (insert or update).
#[tauri::command]
pub fn save_provider_profile(
    state: State<AppState>,
    profile: ProviderProfile,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO provider_profiles (id, label, base_url, api_key, model_name, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)",
        params![profile.id, profile.label, profile.base_url, profile.api_key, profile.model_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a provider profile by ID.
#[tauri::command]
pub fn delete_provider_profile(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM provider_profiles WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get an application setting by key.
#[tauri::command]
pub fn get_app_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT value FROM app_settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![key], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(Ok(value)) => Ok(Some(value)),
        _ => Ok(None),
    }
}

/// Set an application setting.
#[tauri::command]
pub fn set_app_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO app_settings (key, value, updated_at)
         VALUES (?1, ?2, CURRENT_TIMESTAMP)",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete an application setting by key.
#[tauri::command]
pub fn delete_app_setting(state: State<AppState>, key: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM app_settings WHERE key = ?1", params![key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get all application settings.
#[tauri::command]
pub fn get_all_app_settings(state: State<AppState>) -> Result<Vec<AppSetting>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT key, value, updated_at FROM app_settings")
        .map_err(|e| e.to_string())?;

    let settings = stmt
        .query_map([], |row| {
            Ok(AppSetting {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(settings)
}
