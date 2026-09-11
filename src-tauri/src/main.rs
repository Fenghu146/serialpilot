//! SerialPilot 桌面端入口。
//!
//! 负责组装 Tauri 应用：注册命令、注入全局状态、初始化窗口，并在后台启动
//! MCP Server。核心业务逻辑位于库 crate `serialpilot_lib` 中。

use serialpilot_lib::serial::analyzer::{FrameAnalysis, ProtocolAnalyzer};
use serialpilot_lib::serial::checksum::{self, ChecksumType};
use serialpilot_lib::serial::mcp::McpServer;
use serialpilot_lib::serial::port_manager::PortManager;
use serialpilot_lib::serial::script::{ScriptEngine, ScriptResult};
use serialpilot_lib::serial::types::*;
use serde_json::Value;
use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::Mutex;

/// 全局应用状态：以 `Arc<Mutex<_>>` 包裹串口管理器，供各命令与 MCP Server 共享。
pub struct AppState {
    port_manager: Arc<Mutex<PortManager>>,
}

/// 枚举本机可用串口。
#[tauri::command]
fn list_ports() -> Result<Vec<PortInfo>, String> {
    PortManager::list_ports()
}

/// 打开指定串口并应用通信参数（波特率/数据位/停止位/校验/流控）。
#[tauri::command]
async fn open_port(
    state: State<'_, AppState>,
    port_name: String,
    config: PortConfig,
) -> Result<(), String> {
    let manager = state.port_manager.lock().await;
    manager.open(port_name, config).await
}

/// 关闭当前已打开的串口。
#[tauri::command]
async fn close_port(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.port_manager.lock().await;
    manager.close().await
}

/// 向串口写入数据，`mode` 决定按文本还是十六进制解析。
#[tauri::command]
async fn write_port(
    state: State<'_, AppState>,
    data: String,
    mode: WriteMode,
) -> Result<(), String> {
    let manager = state.port_manager.lock().await;
    manager.write_str(&data, mode).await
}

/// 获取当前连接状态与累计收发字节数（供状态栏展示）。
#[tauri::command]
async fn get_connection_status(
    state: State<'_, AppState>,
) -> Result<ConnectionStatus, String> {
    let manager = state.port_manager.lock().await;
    Ok(manager.get_status().await)
}

/// 分析十六进制数据帧，`protocol_hint` 为 `None` 时自动检测协议。
#[tauri::command]
fn analyze_frame(hex_data: String, protocol_hint: Option<String>) -> Result<FrameAnalysis, String> {
    let bytes = checksum::hex_to_bytes(&hex_data)?;
    let analyzer = ProtocolAnalyzer::new();
    Ok(analyzer.analyze(bytes.as_slice(), protocol_hint.as_deref()))
}

/// 计算给定十六进制数据的校验和，返回十六进制字符串。
#[tauri::command]
fn compute_checksum_cmd(hex_data: String, algo: ChecksumType) -> Result<String, String> {
    let bytes = checksum::hex_to_bytes(&hex_data)?;
    let result = checksum::compute_checksum(&bytes, algo);
    Ok(checksum::bytes_to_hex(&result))
}

/// 以 Modbus RTU/TCP 语义解析数据帧。
#[tauri::command]
fn parse_modbus(hex_data: String, is_tcp: bool) -> Result<FrameAnalysis, String> {
    let bytes = checksum::hex_to_bytes(&hex_data)?;
    let analyzer = ProtocolAnalyzer::new();
    let hint = if is_tcp { "modbus_tcp" } else { "modbus_rtu" };
    Ok(analyzer.analyze(bytes.as_slice(), Some(hint)))
}

/// 返回 MCP Server 的基本信息（监听端口、协议与可用工具），供前端展示。
#[tauri::command]
fn get_mcp_info() -> Value {
    serde_json::json!({
        "port": 9777,
        "protocol": "JSON-RPC 2.0",
        "tools": [
            "list_ports", "connect", "disconnect",
            "send", "send_hex", "send_command", "read", "status",
            "analyze_frame"
        ]
    })
}

/// 执行 JSON 自动化脚本并返回测试报告。
#[tauri::command]
async fn run_script(
    state: State<'_, AppState>,
    script: String,
) -> Result<ScriptResult, String> {
    let manager = state.port_manager.clone();
    let engine = ScriptEngine::new(manager);
    Ok(engine.execute(&script).await)
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
            analyze_frame,
            compute_checksum_cmd,
            parse_modbus,
            run_script,
            get_mcp_info,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let manager = manager_clone.clone();
            // 必须在打开端口前设置好 app_handle，否则 emit_log 会静默失败
            tauri::async_runtime::block_on(async move {
                let m = manager.lock().await;
                m.set_app_handle(handle).await;
            });
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("SerialPilot - AI 协同串口调试工具");
                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 1200, height: 800 }));
            }
            let mcp_manager = manager_clone.clone();
            tauri::async_runtime::spawn(async move {
                let server = McpServer::new(mcp_manager, 9777);
                if let Err(e) = server.start().await {
                    log::error!("MCP Server 启动失败: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
