//! SerialPilot 核心库。
//!
//! 该 crate 以「库」的形式导出串口通信与协议分析相关模块，供桌面端入口
//! (`main.rs`) 以及 `tests/` 下的集成测试复用。应用层（Tauri 命令、窗口、
//! 状态管理）保留在 `main.rs`，业务能力全部沉淀在此库中。
//!
//! # 模块划分
//! - [`serial::port_manager`]：串口枚举、打开/关闭、收发与统计
//! - [`serial::analyzer`]：Modbus RTU/TCP、AT 指令、原始帧的协议分析
//! - [`serial::checksum`]：CRC8/CRC16/XOR/SUM 校验和与十六进制互转
//! - [`serial::modbus`]：Modbus 帧结构解析与 CRC 校验
//! - [`serial::script`]：JSON 自动化脚本引擎
//! - [`serial::mcp`]：面向外部 AI Agent 的 MCP Server（JSON-RPC 2.0）
//! - [`serial::types`]：前后端共享的数据结构与枚举

pub mod serial;
