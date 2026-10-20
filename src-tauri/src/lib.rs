use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

mod update;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Configuration {
    pub id: String,
    pub tool: String,
    pub name: String,
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub updated_at: String,
}

#[derive(Default)]
pub struct AppState {
    pub active: Mutex<std::collections::HashMap<String, String>>,
}

#[tauri::command]
fn list_configurations() -> Vec<Configuration> {
    // Persistence will move to SQLite in the next implementation slice.
    Vec::new()
}

#[tauri::command]
fn save_configuration(configuration: Configuration) -> Result<Configuration, String> {
    if configuration.name.trim().is_empty() || configuration.base_url.trim().is_empty() {
        return Err("配置名称和 API Base URL 不能为空".into());
    }
    Ok(configuration)
}

#[tauri::command]
fn delete_configuration(id: String) -> Result<String, String> {
    if id.trim().is_empty() {
        return Err("缺少配置 ID".into());
    }
    Ok(id)
}

#[tauri::command]
fn set_active_configuration(
    tool: String,
    configuration_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut active = state.active.lock().map_err(|_| "无法锁定配置状态")?;
    active.insert(tool, configuration_id);
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionResult {
    ok: bool,
    request_id: String,
    message: String,
}

#[tauri::command]
fn test_connection(
    base_url: String,
    api_key: String,
    tool: String,
) -> Result<ConnectionResult, String> {
    if base_url.trim().is_empty() || api_key.trim().is_empty() {
        return Err("API Base URL 和 API Key 不能为空".into());
    }
    // Network adapters are intentionally isolated behind this command boundary.
    // The API key is never included in logs or returned to the UI.
    Ok(ConnectionResult {
        ok: true,
        request_id: Uuid::new_v4().to_string(),
        message: format!("已准备 {tool} 连接测试"),
    })
}

#[tauri::command]
fn get_models(base_url: String, api_key: String) -> Result<Vec<String>, String> {
    if base_url.trim().is_empty() || api_key.trim().is_empty() {
        return Err("API Base URL 和 API Key 不能为空".into());
    }
    Ok(Vec::new())
}

#[tauri::command]
fn proxy_status() -> serde_json::Value {
    serde_json::json!({ "running": false, "address": "127.0.0.1:0" })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            list_configurations,
            save_configuration,
            delete_configuration,
            set_active_configuration,
            test_connection,
            get_models,
            proxy_status,
            update::check_for_updates
        ])
        .run(tauri::generate_context!())
        .expect("error while running Si Switch");
}
