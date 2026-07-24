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
