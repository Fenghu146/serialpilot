//! 串口业务模块集合，按职责拆分为通信、分析与对外服务三部分。

pub mod analyzer;
pub mod checksum;
pub mod modbus;
pub mod mcp;
pub mod port_manager;
pub mod script;
pub mod types;

pub use port_manager::PortManager;
