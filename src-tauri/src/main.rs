mod serial;

use serial::types::*;
use serial::PortManager;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct AppState {
    port_manager: Arc<Mutex<PortManager>>,
}

#[tauri::command]
fn list_ports() -> Result<Vec<PortInfo>, String> {
    PortManager::list_ports()
}

#[tauri::command]
async fn open_port(
    state: State<'_, AppState>,
    port_name: String,
    config: PortConfig,
) -> Result<(), String> {
    let manager = state.port_manager.lock().await;
    manager.open(port_name, config).await
}

#[tauri::command]
async fn close_port(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.port_manager.lock().await;
    manager.close().await
}

#[tauri::command]
async fn write_port(
    state: State<'_, AppState>,
    data: String,
    mode: WriteMode,
) -> Result<(), String> {
    let manager = state.port_manager.lock().await;
    manager.write_str(&data, mode).await
}

#[tauri::command]
async fn get_connection_status(
    state: State<'_, AppState>,
) -> Result<ConnectionStatus, String> {
    let manager = state.port_manager.lock().await;
    Ok(manager.get_status().await)
}

fn main() {
    env_logger::init();

    let port_manager = Arc::new(Mutex::new(PortManager::new()));
    let manager_clone = port_manager.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { port_manager })
        .invoke_handler(tauri::generate_handler![
            list_ports,
            open_port,
            close_port,
            write_port,
            get_connection_status,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let manager = manager_clone.clone();
            tauri::async_runtime::spawn(async move {
                manager.lock().await.set_app_handle(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
