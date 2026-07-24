use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use crate::serial::PortManager;
use crate::serial::types::*;
use crate::serial::analyzer::ProtocolAnalyzer;
use crate::serial::checksum;

const MCP_VERSION: &str = "2024-11-05";

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

#[derive(Debug, Serialize)]
struct McpTool {
    name: String,
    description: String,
    input_schema: Value,
}

pub struct McpServer {
    port_manager: Arc<Mutex<PortManager>>,
    port: u16,
}

impl McpServer {
    pub fn new(port_manager: Arc<Mutex<PortManager>>, port: u16) -> Self {
        Self { port_manager, port }
    }

    pub async fn start(&self) -> Result<(), String> {
        let addr = format!("127.0.0.1:{}", self.port);
        let listener = TcpListener::bind(&addr).await
            .map_err(|e| format!("MCP Server 绑定失败: {}", e))?;

        log::info!("MCP Server 启动于 {}", addr);

        let port_manager = self.port_manager.clone();

        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    log::info!("MCP 客户端连接: {}", addr);
                    let pm = port_manager.clone();
                    tokio::spawn(async move {
                        if let Err(e) = handle_client(stream, pm).await {
                            log::error!("MCP 客户端处理错误: {}", e);
                        }
                    });
                }
                Err(e) => {
                    log::error!("MCP accept 错误: {}", e);
                }
            }
        }
    }
}

async fn handle_client(stream: TcpStream, port_manager: Arc<Mutex<PortManager>>) -> Result<(), String> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();

    while reader.read_line(&mut line).await.map_err(|e| e.to_string())? > 0 {
        let request: JsonRpcRequest = match serde_json::from_str(&line) {
            Ok(req) => req,
            Err(e) => {
                let resp = JsonRpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id: None,
                    result: None,
                    error: Some(JsonRpcError {
                        code: -32700,
                        message: format!("Parse error: {}", e),
                    }),
                };
                send_response(&mut writer, &resp).await?;
                line.clear();
                continue;
            }
        };

        let resp = handle_request(request, &port_manager).await;
        send_response(&mut writer, &resp).await?;
        line.clear();
    }

    Ok(())
}

async fn send_response(writer: &mut tokio::net::tcp::OwnedWriteHalf, resp: &JsonRpcResponse) -> Result<(), String> {
    let json = serde_json::to_string(resp).map_err(|e| e.to_string())?;
    writer.write_all(json.as_bytes()).await.map_err(|e| e.to_string())?;
    writer.write_all(b"\n").await.map_err(|e| e.to_string())?;
    writer.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn handle_request(request: JsonRpcRequest, port_manager: &Arc<Mutex<PortManager>>) -> JsonRpcResponse {
    let result = match request.method.as_str() {
        "initialize" => handle_initialize(),
        "tools/list" => handle_list_tools(),
        "tools/call" => handle_tool_call(request.params, port_manager).await,
        "ping" => Ok(json!({})),
        _ => Err(JsonRpcError {
            code: -32601,
            message: format!("Method not found: {}", request.method),
        }),
    };

    match result {
        Ok(value) => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: Some(value),
            error: None,
        },
        Err(err) => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: None,
            error: Some(err),
        },
    }
}

fn handle_initialize() -> Result<Value, JsonRpcError> {
    Ok(json!({
        "protocolVersion": MCP_VERSION,
        "capabilities": {
            "tools": {}
        },
        "serverInfo": {
            "name": "SerialPilot MCP",
            "version": "0.1.0"
        }
    }))
}

fn handle_list_tools() -> Result<Value, JsonRpcError> {
    let tools = vec![
        McpTool {
            name: "list_ports".to_string(),
            description: "列出所有可用串口".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
        },
        McpTool {
            name: "connect".to_string(),
            description: "连接指定串口".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "port": { "type": "string", "description": "串口名称，如 COM3 或 /dev/ttyUSB0" },
                    "baud_rate": { "type": "number", "description": "波特率", "default": 115200 },
                    "data_bits": { "type": "string", "description": "数据位", "default": "Eight" },
                    "stop_bits": { "type": "string", "description": "停止位", "default": "One" },
                    "parity": { "type": "string", "description": "校验位", "default": "None" }
                },
                "required": ["port"]
            }),
        },
        McpTool {
            name: "disconnect".to_string(),
            description: "断开当前串口连接".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
        },
        McpTool {
            name: "send".to_string(),
            description: "发送数据到串口（文本模式）".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "data": { "type": "string", "description": "要发送的数据" }
                },
                "required": ["data"]
            }),
        },
        McpTool {
            name: "send_hex".to_string(),
            description: "发送十六进制数据到串口".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "hex": { "type": "string", "description": "十六进制字符串，如 '01 03 00 00 00 0A'" }
                },
                "required": ["hex"]
            }),
        },
        McpTool {
            name: "send_command".to_string(),
            description: "发送命令并等待响应（用于 AT 指令等）".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "要发送的命令" },
                    "timeout_ms": { "type": "number", "description": "等待超时(毫秒)", "default": 2000 }
                },
                "required": ["command"]
            }),
        },
        McpTool {
            name: "read".to_string(),
            description: "读取串口接收缓冲区".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "timeout_ms": { "type": "number", "description": "读取超时(毫秒)", "default": 1000 }
                }
            }),
        },
        McpTool {
            name: "status".to_string(),
            description: "获取当前连接状态和统计".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
        },
        McpTool {
            name: "analyze_frame".to_string(),
            description: "分析数据帧结构（支持 Modbus RTU/TCP、AT 指令）".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "hex_data": { "type": "string", "description": "十六进制数据" },
                    "protocol": { "type": "string", "description": "协议提示: modbus_rtu, modbus_tcp, at_command, auto", "default": "auto" }
                },
                "required": ["hex_data"]
            }),
        },
    ];

    Ok(json!({
        "tools": tools.iter().map(|t| json!({
            "name": t.name,
            "description": t.description,
            "inputSchema": t.input_schema
        })).collect::<Vec<_>>()
    }))
}

async fn handle_tool_call(params: Option<Value>, port_manager: &Arc<Mutex<PortManager>>) -> Result<Value, JsonRpcError> {
    let params = params.ok_or(JsonRpcError {
        code: -32602,
        message: "Invalid params".to_string(),
    })?;

    let name = params.get("name")
        .and_then(|v| v.as_str())
        .ok_or(JsonRpcError { code: -32602, message: "Missing tool name".to_string() })?;

    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    match name {
        "list_ports" => {
            let ports = PortManager::list_ports()
                .map_err(|e| JsonRpcError { code: -32603, message: e })?;
            let ports_json: Vec<Value> = ports.iter().map(|p| {
                json!({
                    "port_name": p.port_name,
                    "port_type": p.port_type,
                    "manufacturer": p.manufacturer,
                    "product": p.product,
                    "vid": p.vid,
                    "pid": p.pid,
                })
            }).collect();
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&ports_json).unwrap() }]
            }))
        }
        "connect" => {
            let port = arguments.get("port").and_then(|v| v.as_str()).ok_or(JsonRpcError {
                code: -32602, message: "Missing port".to_string()
            })?;
            let baud_rate = arguments.get("baud_rate").and_then(|v| v.as_u64()).unwrap_or(115200) as u32;
            let config = PortConfig {
                baud_rate,
                data_bits: parse_data_bits(arguments.get("data_bits").and_then(|v| v.as_str())),
                stop_bits: parse_stop_bits(arguments.get("stop_bits").and_then(|v| v.as_str())),
                parity: parse_parity(arguments.get("parity").and_then(|v| v.as_str())),
                flow_control: FlowControl::None,
            };
            let manager = port_manager.lock().await;
            manager.open(port.to_string(), config).await
                .map_err(|e| JsonRpcError { code: -32603, message: e })?;
            Ok(json!({ "content": [{ "type": "text", "text": format!("已连接 {}", port) }] }))
        }
        "disconnect" => {
            let manager = port_manager.lock().await;
            manager.close().await
                .map_err(|e| JsonRpcError { code: -32603, message: e })?;
            Ok(json!({ "content": [{ "type": "text", "text": "已断开" }] }))
        }
        "send" => {
            let data = arguments.get("data").and_then(|v| v.as_str()).ok_or(JsonRpcError {
                code: -32602, message: "Missing data".to_string()
            })?;
            let manager = port_manager.lock().await;
            manager.write_str(data, WriteMode::Text).await
                .map_err(|e| JsonRpcError { code: -32603, message: e })?;
            Ok(json!({ "content": [{ "type": "text", "text": format!("已发送: {}", data) }] }))
        }
        "send_hex" => {
            let hex = arguments.get("hex").and_then(|v| v.as_str()).ok_or(JsonRpcError {
                code: -32602, message: "Missing hex".to_string()
            })?;
            let manager = port_manager.lock().await;
            manager.write_str(hex, WriteMode::Hex).await
                .map_err(|e| JsonRpcError { code: -32603, message: e })?;
            Ok(json!({ "content": [{ "type": "text", "text": format!("已发送 HEX: {}", hex) }] }))
        }
        "send_command" => {
            let command = arguments.get("command").and_then(|v| v.as_str()).ok_or(JsonRpcError {
                code: -32602, message: "Missing command".to_string()
            })?;
            let timeout = arguments.get("timeout_ms").and_then(|v| v.as_u64()).unwrap_or(2000);
            let manager = port_manager.lock().await;
            manager.write_str(command, WriteMode::Text).await
                .map_err(|e| JsonRpcError { code: -32603, message: e })?;
            tokio::time::sleep(tokio::time::Duration::from_millis(timeout.min(100))).await;
            Ok(json!({ "content": [{ "type": "text", "text": format!("命令已发送: {}", command) }] }))
        }
        "read" => {
            let _timeout = arguments.get("timeout_ms").and_then(|v| v.as_u64()).unwrap_or(1000);
            Ok(json!({ "content": [{ "type": "text", "text": "读取功能需要事件流支持" }] }))
        }
        "status" => {
            let manager = port_manager.lock().await;
            let status = manager.get_status().await;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&status).unwrap()
                }]
            }))
        }
        "analyze_frame" => {
            let hex_data = arguments.get("hex_data").and_then(|v| v.as_str()).ok_or(JsonRpcError {
                code: -32602, message: "Missing hex_data".to_string()
            })?;
            let protocol = arguments.get("protocol").and_then(|v| v.as_str());
            let bytes = checksum::hex_to_bytes(hex_data)
                .map_err(|e| JsonRpcError { code: -32603, message: e })?;
            let analyzer = ProtocolAnalyzer::new();
            let result = analyzer.analyze(&bytes, protocol);
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&result).unwrap()
                }]
            }))
        }
        _ => Err(JsonRpcError { code: -32601, message: format!("Unknown tool: {}", name) }),
    }
}

fn parse_data_bits(s: Option<&str>) -> DataBits {
    match s {
        Some("Five") => DataBits::Five,
        Some("Six") => DataBits::Six,
        Some("Seven") => DataBits::Seven,
        _ => DataBits::Eight,
    }
}

fn parse_stop_bits(s: Option<&str>) -> StopBits {
    match s {
        Some("Two") => StopBits::Two,
        _ => StopBits::One,
    }
}

fn parse_parity(s: Option<&str>) -> Parity {
    match s {
        Some("Odd") => Parity::Odd,
        Some("Even") => Parity::Even,
        Some("Mark") => Parity::Mark,
        Some("Space") => Parity::Space,
        _ => Parity::None,
    }
}
