use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusFrame {
    pub slave_id: u8,
    pub function_code: u8,
    pub function_name: String,
    pub data: Vec<u8>,
    pub crc: Option<Vec<u8>>,
    pub crc_valid: Option<bool>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusTcpFrame {
    pub transaction_id: u16,
    pub protocol_id: u16,
    pub length: u16,
    pub unit_id: u8,
    pub function_code: u8,
    pub function_name: String,
    pub data: Vec<u8>,
    pub raw: String,
}

pub fn parse_modbus_rtu(raw: &[u8]) -> Option<ModbusFrame> {
    if raw.len() < 4 {
        return None;
    }

    let slave_id = raw[0];
    let function_code = raw[1];
    let data_end = raw.len() - 2;
    let data = raw[2..data_end].to_vec();

    let crc = vec![raw[data_end], raw[data_end + 1]];
    let crc_valid = Some(verify_modbus_crc(raw));

    let function_name = match function_code {
        0x01 => "Read Coils",
        0x02 => "Read Discrete Inputs",
        0x03 => "Read Holding Registers",
        0x04 => "Read Input Registers",
        0x05 => "Write Single Coil",
        0x06 => "Write Single Register",
        0x0F => "Write Multiple Coils",
        0x10 => "Write Multiple Registers",
        0x17 => "Read/Write Multiple Registers",
        0x18 => "Read FIFO Queue",
        _ => "Unknown",
    }
    .to_string();

    Some(ModbusFrame {
        slave_id,
        function_code,
        function_name,
        data,
        crc: Some(crc),
        crc_valid,
        raw: bytes_to_hex_string(raw),
    })
}

pub fn parse_modbus_tcp(raw: &[u8]) -> Option<ModbusTcpFrame> {
    if raw.len() < 8 {
        return None;
    }

    let transaction_id = u16::from_be_bytes([raw[0], raw[1]]);
    let protocol_id = u16::from_be_bytes([raw[2], raw[3]]);
    let length = u16::from_be_bytes([raw[4], raw[5]]);
    let unit_id = raw[6];
    let function_code = raw[7];
    let data = raw[8..].to_vec();

    let function_name = match function_code {
        0x01 => "Read Coils",
        0x02 => "Read Discrete Inputs",
        0x03 => "Read Holding Registers",
        0x04 => "Read Input Registers",
        0x05 => "Write Single Coil",
        0x06 => "Write Single Register",
        0x0F => "Write Multiple Coils",
        0x10 => "Write Multiple Registers",
        0x17 => "Read/Write Multiple Registers",
        0x18 => "Read FIFO Queue",
        _ => "Unknown",
    }
    .to_string();

    Some(ModbusTcpFrame {
        transaction_id,
        protocol_id,
        length,
        unit_id,
        function_code,
        function_name,
        data,
        raw: bytes_to_hex_string(raw),
    })
}

fn verify_modbus_crc(frame: &[u8]) -> bool {
    if frame.len() < 3 {
        return false;
    }
    let data = &frame[..frame.len() - 2];
    let expected_crc = &frame[frame.len() - 2..];
    let computed = compute_modbus_crc(data);
    computed == expected_crc
}

fn compute_modbus_crc(data: &[u8]) -> Vec<u8> {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 0x0001 != 0 {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    vec![(crc & 0xFF) as u8, ((crc >> 8) & 0xFF) as u8]
}

fn bytes_to_hex_string(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ")
}

pub fn decode_register_values(data: &[u8]) -> Vec<u16> {
    let mut values = Vec::new();
    for chunk in data.chunks_exact(2) {
        values.push(u16::from_be_bytes([chunk[0], chunk[1]]));
    }
    values
}

pub fn decode_coil_values(data: &[u8], count: u16) -> Vec<bool> {
    let mut values = Vec::new();
    for (_byte_idx, &byte) in data.iter().enumerate() {
        for bit in 0..8 {
            if values.len() >= count as usize {
                break;
            }
            values.push(byte & (1 << bit) != 0);
        }
        if values.len() >= count as usize {
            break;
        }
    }
    values
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_modbus_rtu_read_holding_registers() {
        // Slave 1, FC 03 (Read Holding Registers), Addr 0x0000, Qty 0x000A
        // Correct CRC16 Modbus for [0x01, 0x03, 0x00, 0x00, 0x00, 0x0A] = [0xC5, 0xCD]
        let raw = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xC5, 0xCD];
        let frame = parse_modbus_rtu(&raw).unwrap();
        assert_eq!(frame.slave_id, 1);
        assert_eq!(frame.function_code, 3);
        assert_eq!(frame.function_name, "Read Holding Registers");
        assert_eq!(frame.data, vec![0x00, 0x00, 0x00, 0x0A]);
        assert_eq!(frame.crc_valid, Some(true));
    }

    #[test]
    fn test_parse_modbus_rtu_invalid_crc() {
        let raw = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xFF, 0xFF];
        let frame = parse_modbus_rtu(&raw).unwrap();
        assert_eq!(frame.crc_valid, Some(false));
    }

    #[test]
    fn test_parse_modbus_rtu_too_short() {
        let raw = vec![0x01u8, 0x03];
        assert!(parse_modbus_rtu(&raw).is_none());
    }

    #[test]
    fn test_parse_modbus_tcp_read_holding_registers() {
        // Transaction ID 0x0001, Protocol ID 0x0000, Length 0x0006, Unit ID 0x01, FC 03
        let raw = vec![0x00u8, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
        let frame = parse_modbus_tcp(&raw).unwrap();
        assert_eq!(frame.transaction_id, 1);
        assert_eq!(frame.protocol_id, 0);
        assert_eq!(frame.length, 6);
        assert_eq!(frame.unit_id, 1);
        assert_eq!(frame.function_code, 3);
        assert_eq!(frame.function_name, "Read Holding Registers");
    }

    #[test]
    fn test_parse_modbus_tcp_too_short() {
        let raw = vec![0x00u8, 0x01, 0x00, 0x00, 0x00];
        assert!(parse_modbus_tcp(&raw).is_none());
    }

    #[test]
    fn test_decode_register_values() {
        let data = vec![0x00u8, 0x0A, 0x01, 0x02];
        let values = decode_register_values(&data);
        assert_eq!(values, vec![0x000A, 0x0102]);
    }

    #[test]
    fn test_decode_coil_values() {
        let data = vec![0xA5u8]; // 10100101
        let values = decode_coil_values(&data, 8);
        assert_eq!(values, vec![true, false, true, false, false, true, false, true]);
    }

    #[test]
    fn test_verify_modbus_crc_valid() {
        // Correct CRC for [0x01, 0x03, 0x00, 0x00, 0x00, 0x0A] is [0xC5, 0xCD]
        let frame = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xC5, 0xCD];
        assert!(verify_modbus_crc(&frame));
    }

    #[test]
    fn test_verify_modbus_crc_invalid() {
        let frame = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xFF, 0xFF];
        assert!(!verify_modbus_crc(&frame));
    }

    #[test]
    fn test_compute_modbus_crc() {
        let data = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A];
        let crc = compute_modbus_crc(&data);
        assert_eq!(crc, vec![0xC5, 0xCD]);
    }
}
