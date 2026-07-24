use serde::{Deserialize, Serialize};
use crate::serial::checksum;
use crate::serial::modbus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameAnalysis {
    pub protocol: String,
    pub raw_hex: String,
    pub fields: Vec<FrameField>,
    pub checksum_valid: Option<bool>,
    pub anomalies: Vec<String>,
    pub decoded: Option<DecodedFrame>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameField {
    pub name: String,
    pub offset: usize,
    pub length: usize,
    pub value: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DecodedFrame {
    ModbusRtu(modbus::ModbusFrame),
    ModbusTcp(modbus::ModbusTcpFrame),
    AtCommand {
        command: String,
        response: bool,
        args: Vec<String>,
    },
    Custom {
        format: String,
        values: Vec<FieldValue>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldValue {
    pub name: String,
    pub raw: String,
    pub interpreted: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyResult {
    pub timestamp: String,
    pub anomaly_type: String,
    pub description: String,
    pub severity: AnomalySeverity,
    pub raw_data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnomalySeverity {
    Info,
    Warning,
    Error,
    Critical,
}

pub struct ProtocolAnalyzer;

impl ProtocolAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub fn analyze(&self, raw: &[u8], protocol_hint: Option<&str>) -> FrameAnalysis {
        if raw.is_empty() {
            return FrameAnalysis {
                protocol: "Empty".to_string(),
                raw_hex: String::new(),
                fields: vec![],
                checksum_valid: None,
                anomalies: vec!["空数据帧".to_string()],
                decoded: None,
            };
        }

        let hint = protocol_hint.unwrap_or("auto");

        match hint {
            "modbus_rtu" | "auto" if raw.len() >= 4 && Self::looks_like_modbus_rtu(raw) => {
                self.analyze_modbus_rtu(raw)
            }
            "modbus_tcp" | "auto" if raw.len() >= 8 && Self::looks_like_modbus_tcp(raw) => {
                self.analyze_modbus_tcp(raw)
            }
            "at_command" | "auto" => self.analyze_at_command(raw),
            _ => self.analyze_raw(raw),
        }
    }

    fn looks_like_modbus_rtu(raw: &[u8]) -> bool {
        if raw.len() < 4 {
            return false;
        }
        let fc = raw[1];
        matches!(fc, 0x01..=0x06 | 0x0F | 0x10 | 0x17 | 0x18)
    }

    fn looks_like_modbus_tcp(raw: &[u8]) -> bool {
        if raw.len() < 8 {
            return false;
        }
        let protocol_id = u16::from_be_bytes([raw[2], raw[3]]);
        protocol_id == 0x0000
    }

    fn analyze_modbus_rtu(&self, raw: &[u8]) -> FrameAnalysis {
        if let Some(frame) = modbus::parse_modbus_rtu(raw) {
            let mut fields = vec![
                FrameField {
                    name: "Slave ID".to_string(),
                    offset: 0,
                    length: 1,
                    value: format!("0x{:02X} ({})", frame.slave_id, frame.slave_id),
                    description: "从机地址".to_string(),
                },
                FrameField {
                    name: "Function Code".to_string(),
                    offset: 1,
                    length: 1,
                    value: format!("0x{:02X}", frame.function_code),
                    description: frame.function_name.clone(),
                },
            ];

            let data_start = 2;
            let data_len = frame.data.len();

            match frame.function_code {
                0x03 | 0x04 => {
                    if frame.data.len() >= 2 {
                        let start_addr = u16::from_be_bytes([frame.data[0], frame.data[1]]);
                        let quantity = if frame.data.len() >= 4 {
                            u16::from_be_bytes([frame.data[2], frame.data[3]])
                        } else {
                            0
                        };
                        fields.push(FrameField {
                            name: "Start Address".to_string(),
                            offset: data_start,
                            length: 2,
                            value: format!("0x{:04X} ({})", start_addr, start_addr),
                            description: "起始寄存器地址".to_string(),
                        });
                        if quantity > 0 {
                            fields.push(FrameField {
                                name: "Quantity".to_string(),
                                offset: data_start + 2,
                                length: 2,
                                value: format!("{}", quantity),
                                description: "寄存器数量".to_string(),
                            });
                        }
                    }
                    if frame.function_code == 0x03 && frame.data.len() > 0 && frame.data.len() % 2 == 0 {
                        let registers = modbus::decode_register_values(&frame.data);
                        for (i, val) in registers.iter().enumerate() {
                            fields.push(FrameField {
                                name: format!("Register[{}]", i),
                                offset: data_start + i * 2,
                                length: 2,
                                value: format!("0x{:04X} ({})", val, val),
                                description: format!("寄存器值 ({})\n  十进制: {}\n  二进制: {:016b}", val, val, val),
                            });
                        }
                    }
                }
                0x06 => {
                    if frame.data.len() >= 4 {
                        let addr = u16::from_be_bytes([frame.data[0], frame.data[1]]);
                        let value = u16::from_be_bytes([frame.data[2], frame.data[3]]);
                        fields.push(FrameField {
                            name: "Register Address".to_string(),
                            offset: data_start,
                            length: 2,
                            value: format!("0x{:04X}", addr),
                            description: "寄存器地址".to_string(),
                        });
                        fields.push(FrameField {
                            name: "Register Value".to_string(),
                            offset: data_start + 2,
                            length: 2,
                            value: format!("0x{:04X} ({})", value, value),
                            description: "写入值".to_string(),
                        });
                    }
                }
                _ => {
                    fields.push(FrameField {
                        name: "Data".to_string(),
                        offset: data_start,
                        length: data_len,
                        value: checksum::bytes_to_hex(&frame.data),
                        description: format!("数据字段 ({} 字节)", data_len),
                    });
                }
            }

            fields.push(FrameField {
                name: "CRC".to_string(),
                offset: raw.len() - 2,
                length: 2,
                value: frame.crc.as_ref().map(|c| checksum::bytes_to_hex(c)).unwrap_or_default(),
                description: if frame.crc_valid == Some(true) {
                    "CRC 校验 ✓".to_string()
                } else {
                    "CRC 校验 ✗".to_string()
                },
            });

            let anomalies = if frame.crc_valid == Some(false) {
                vec!["CRC 校验失败".to_string()]
            } else {
                vec![]
            };

            FrameAnalysis {
                protocol: "Modbus RTU".to_string(),
                raw_hex: frame.raw.clone(),
                fields,
                checksum_valid: frame.crc_valid,
                anomalies,
                decoded: Some(DecodedFrame::ModbusRtu(frame)),
            }
        } else {
            self.analyze_raw(raw)
        }
    }

    fn analyze_modbus_tcp(&self, raw: &[u8]) -> FrameAnalysis {
        if let Some(frame) = modbus::parse_modbus_tcp(raw) {
            let fields = vec![
                FrameField {
                    name: "Transaction ID".to_string(),
                    offset: 0,
                    length: 2,
                    value: format!("0x{:04X}", frame.transaction_id),
                    description: "事务标识符".to_string(),
                },
                FrameField {
                    name: "Protocol ID".to_string(),
                    offset: 2,
                    length: 2,
                    value: format!("0x{:04X}", frame.protocol_id),
                    description: "协议标识符 (0=Modbus)".to_string(),
                },
                FrameField {
                    name: "Length".to_string(),
                    offset: 4,
                    length: 2,
                    value: format!("{}", frame.length),
                    description: "后续字节数".to_string(),
                },
                FrameField {
                    name: "Unit ID".to_string(),
                    offset: 6,
                    length: 1,
                    value: format!("{}", frame.unit_id),
                    description: "单元标识符".to_string(),
                },
                FrameField {
                    name: "Function Code".to_string(),
                    offset: 7,
                    length: 1,
                    value: format!("0x{:02X}", frame.function_code),
                    description: frame.function_name.clone(),
                },
            ];

            FrameAnalysis {
                protocol: "Modbus TCP".to_string(),
                raw_hex: frame.raw.clone(),
                fields,
                checksum_valid: None,
                anomalies: vec![],
                decoded: Some(DecodedFrame::ModbusTcp(frame)),
            }
        } else {
            self.analyze_raw(raw)
        }
    }

    fn analyze_at_command(&self, raw: &[u8]) -> FrameAnalysis {
        let text = String::from_utf8_lossy(raw);
        let text = text.trim();

        if text.is_empty() {
            return self.analyze_raw(raw);
        }

        let is_response = text.contains("OK")
            || text.contains("ERROR")
            || text.contains("+")
            || text.starts_with("AT");

        let mut fields = vec![];
        let mut anomalies = vec![];

        if text.contains("OK") {
            fields.push(FrameField {
                name: "Status".to_string(),
                offset: 0,
                length: 2,
                value: "OK".to_string(),
                description: "命令执行成功".to_string(),
            });
        }
        if text.contains("ERROR") {
            fields.push(FrameField {
                name: "Status".to_string(),
                offset: 0,
                length: 5,
                value: "ERROR".to_string(),
                description: "命令执行失败".to_string(),
            });
            anomalies.push("AT 指令返回 ERROR".to_string());
        }

        let command = if text.starts_with("AT") {
            text.split('\n').next().unwrap_or("").trim().to_string()
        } else {
            String::new()
        };

        if !command.is_empty() {
            fields.insert(0, FrameField {
                name: "Command".to_string(),
                offset: 0,
                length: command.len(),
                value: command.clone(),
                description: "AT 指令".to_string(),
            });
        }

        FrameAnalysis {
            protocol: "AT Command".to_string(),
            raw_hex: checksum::bytes_to_hex(raw),
            fields,
            checksum_valid: None,
            anomalies,
            decoded: Some(DecodedFrame::AtCommand {
                command,
                response: is_response,
                args: vec![],
            }),
        }
    }

    fn analyze_raw(&self, raw: &[u8]) -> FrameAnalysis {
        let mut fields = vec![];

        if !raw.is_empty() {
            fields.push(FrameField {
                name: "Raw Data".to_string(),
                offset: 0,
                length: raw.len(),
                value: checksum::bytes_to_hex(raw),
                description: format!("原始数据 ({} 字节)", raw.len()),
            });

            if raw.len() >= 2 {
                fields.push(FrameField {
                    name: "First Byte".to_string(),
                    offset: 0,
                    length: 1,
                    value: format!("0x{:02X}", raw[0]),
                    description: "首字节 (可能的帧头)".to_string(),
                });
                fields.push(FrameField {
                    name: "Last Byte".to_string(),
                    offset: raw.len() - 1,
                    length: 1,
                    value: format!("0x{:02X}", raw[raw.len() - 1]),
                    description: "末字节 (可能的校验)".to_string(),
                });
            }
        }

        FrameAnalysis {
            protocol: "Raw/Unknown".to_string(),
            raw_hex: checksum::bytes_to_hex(raw),
            fields,
            checksum_valid: None,
            anomalies: vec![],
            decoded: None,
        }
    }

    pub fn detect_anomalies(
        &self,
        raw: &[u8],
        expected_response_ms: u64,
        actual_response_ms: u64,
    ) -> Vec<AnomalyResult> {
        let mut anomalies = Vec::new();

        if actual_response_ms > expected_response_ms {
            anomalies.push(AnomalyResult {
                timestamp: chrono::Local::now().format("%H:%M:%S%.3f").to_string(),
                anomaly_type: "Timeout".to_string(),
                description: format!(
                    "应答超时: 实际 {}ms, 预期 <{}ms",
                    actual_response_ms, expected_response_ms
                ),
                severity: AnomalySeverity::Warning,
                raw_data: checksum::bytes_to_hex(raw),
            });
        }

        if raw.is_empty() {
            anomalies.push(AnomalyResult {
                timestamp: chrono::Local::now().format("%H:%M:%S%.3f").to_string(),
                anomaly_type: "Empty Response".to_string(),
                description: "空响应 (无数据返回)".to_string(),
                severity: AnomalySeverity::Error,
                raw_data: String::new(),
            });
        }

        let text = String::from_utf8_lossy(raw);
        if text.contains("ERROR") {
            anomalies.push(AnomalyResult {
                timestamp: chrono::Local::now().format("%H:%M:%S%.3f").to_string(),
                anomaly_type: "Command Error".to_string(),
                description: "指令执行返回 ERROR".to_string(),
                severity: AnomalySeverity::Error,
                raw_data: checksum::bytes_to_hex(raw),
            });
        }

        anomalies
    }
}
