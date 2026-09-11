//! SerialPilot 核心逻辑集成测试。
//!
//! 覆盖校验和计算、十六进制编解码、Modbus RTU/TCP 解析、AT 指令解析与
//! 协议自动识别等关键路径。运行方式：`cargo test`（在 `src-tauri/` 目录下）。

use serialpilot_lib::serial::analyzer::ProtocolAnalyzer;
use serialpilot_lib::serial::checksum::{self, ChecksumType};

/// Modbus RTU 读保持寄存器请求帧：从机 1、功能码 03、起始地址 0、数量 10。
/// 其正确的 CRC16-Modbus 为 `C5 CD`（小端序）。
const MODBUS_RTU_FRAME: [u8; 8] = [0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xC5, 0xCD];

#[test]
fn crc16_modbus_matches_known_vector() {
    // CRC16-Modbus("123456789") == 0x4B37，小端序输出为 [0x37, 0x4B]
    let crc = checksum::compute_checksum(b"123456789", ChecksumType::Crc16Modbus);
    assert_eq!(crc, vec![0x37, 0x4B]);
}

#[test]
fn hex_conversion_roundtrip() {
    let hex = "01 03 00 00 00 0A";
    let bytes = checksum::hex_to_bytes(hex).unwrap();
    assert_eq!(bytes, vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]);
    assert_eq!(checksum::bytes_to_hex(&bytes), "01 03 00 00 00 0A");
}

#[test]
fn hex_conversion_rejects_odd_length() {
    assert!(checksum::hex_to_bytes("01030").is_err());
}

#[test]
fn modbus_rtu_frame_is_analyzed() {
    let analysis = ProtocolAnalyzer::new().analyze(&MODBUS_RTU_FRAME, Some("modbus_rtu"));
    assert_eq!(analysis.protocol, "Modbus RTU");
    assert_eq!(analysis.checksum_valid, Some(true));
    assert!(analysis.fields.iter().any(|f| f.name == "Slave ID"));
    assert!(analysis.fields.iter().any(|f| f.name == "Function Code"));
}

#[test]
fn modbus_rtu_invalid_crc_is_flagged() {
    let frame = [0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xFF, 0xFF];
    let analysis = ProtocolAnalyzer::new().analyze(&frame, Some("modbus_rtu"));
    assert_eq!(analysis.checksum_valid, Some(false));
    assert!(!analysis.anomalies.is_empty());
}

#[test]
fn modbus_tcp_frame_is_analyzed() {
    let frame = [0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
    let analysis = ProtocolAnalyzer::new().analyze(&frame, Some("modbus_tcp"));
    assert_eq!(analysis.protocol, "Modbus TCP");
    assert_eq!(analysis.fields.len(), 5);
}

#[test]
fn at_command_is_recognized() {
    let analysis = ProtocolAnalyzer::new().analyze(b"AT\r\n", Some("at_command"));
    assert_eq!(analysis.protocol, "AT Command");
}

#[test]
fn at_error_response_is_flagged() {
    let analysis = ProtocolAnalyzer::new().analyze(b"AT+BADCMD\r\nERROR\r\n", Some("at_command"));
    assert_eq!(analysis.protocol, "AT Command");
    assert!(!analysis.anomalies.is_empty());
}

#[test]
fn protocol_is_auto_detected() {
    let analysis = ProtocolAnalyzer::new().analyze(&MODBUS_RTU_FRAME, None);
    assert_eq!(analysis.protocol, "Modbus RTU");
}

#[test]
fn empty_frame_reports_anomaly() {
    let analysis = ProtocolAnalyzer::new().analyze(&[], None);
    assert_eq!(analysis.protocol, "Empty");
    assert!(!analysis.anomalies.is_empty());
}

#[test]
fn raw_unknown_protocol_falls_back() {
    let analysis = ProtocolAnalyzer::new().analyze(&[0xFF, 0xAA, 0x55], Some("unknown_protocol"));
    assert_eq!(analysis.protocol, "Raw/Unknown");
}

#[test]
fn frame_crc_is_verifiable() {
    let data = &MODBUS_RTU_FRAME[..MODBUS_RTU_FRAME.len() - 2];
    let computed = checksum::compute_checksum(data, ChecksumType::Crc16Modbus);
    let expected = &MODBUS_RTU_FRAME[MODBUS_RTU_FRAME.len() - 2..];
    assert_eq!(computed.as_slice(), expected);
}
