#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChecksumType {
    Crc8,
    Crc16,
    Crc16Modbus,
    Xor8,
    Xor16,
    Sum8,
    Sum16,
}

pub fn verify_checksum(data: &[u8], expected: &[u8], algo: ChecksumType) -> bool {
    let computed = compute_checksum(data, algo);
    computed == expected
}

pub fn compute_checksum(data: &[u8], algo: ChecksumType) -> Vec<u8> {
    match algo {
        ChecksumType::Crc8 => vec![crc8(data)],
        ChecksumType::Crc16 => {
            let v = crc16_ccitt(data);
            vec![(v & 0xFF) as u8, ((v >> 8) & 0xFF) as u8]
        }
        ChecksumType::Crc16Modbus => {
            let v = crc16_modbus(data);
            vec![(v & 0xFF) as u8, ((v >> 8) & 0xFF) as u8]
        }
        ChecksumType::Xor8 => vec![xor8(data)],
        ChecksumType::Xor16 => {
            let v = xor16(data);
            vec![(v & 0xFF) as u8, ((v >> 8) & 0xFF) as u8]
        }
        ChecksumType::Sum8 => vec![sum8(data)],
        ChecksumType::Sum16 => {
            let v = sum16(data);
            vec![(v & 0xFF) as u8, ((v >> 8) & 0xFF) as u8]
        }
    }
}

fn crc8(data: &[u8]) -> u8 {
    let mut crc: u8 = 0;
    for &byte in data {
        crc ^= byte;
        for _ in 0..8 {
            if crc & 0x80 != 0 {
                crc = (crc << 1) ^ 0x07;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

fn crc16_modbus(data: &[u8]) -> u16 {
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
    crc
}

fn xor8(data: &[u8]) -> u8 {
    data.iter().fold(0u8, |acc, &b| acc ^ b)
}

fn xor16(data: &[u8]) -> u16 {
    let mut result: u16 = 0;
    for chunk in data.chunks(2) {
        let val = if chunk.len() == 2 {
            u16::from_be_bytes([chunk[0], chunk[1]])
        } else {
            (chunk[0] as u16) << 8
        };
        result ^= val;
    }
    result
}

fn sum8(data: &[u8]) -> u8 {
    data.iter().fold(0u8, |acc, &b| acc.wrapping_add(b))
}

fn sum16(data: &[u8]) -> u16 {
    let mut result: u16 = 0;
    for chunk in data.chunks(2) {
        let val = if chunk.len() == 2 {
            u16::from_be_bytes([chunk[0], chunk[1]])
        } else {
            (chunk[0] as u16) << 8
        };
        result = result.wrapping_add(val);
    }
    result
}

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crc16_modbus_basic() {
        // Well-known test vector: CRC16 Modbus of "123456789" = 0x4B37
        let data = b"123456789";
        let crc = compute_checksum(data, ChecksumType::Crc16Modbus);
        assert_eq!(crc, vec![0x37, 0x4B]); // Little-endian output
    }

    #[test]
    fn test_crc16_modbus_modbus_frame() {
        // CRC of [0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]
        let data = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A];
        let crc = compute_checksum(&data, ChecksumType::Crc16Modbus);
        assert_eq!(crc.len(), 2);
        // Correct CRC16 Modbus: 0xCDC5 (little-endian: [0xC5, 0xCD])
        assert_eq!(crc, vec![0xC5, 0xCD]);
    }

    #[test]
    fn test_crc16_modbus_empty() {
        let data: Vec<u8> = vec![];
        let crc = compute_checksum(&data, ChecksumType::Crc16Modbus);
        assert_eq!(crc, vec![0xFF, 0xFF]);
    }

    #[test]
    fn test_hex_to_bytes_roundtrip() {
        let hex = "01 03 00 00 00 0A";
        let bytes = hex_to_bytes(hex).unwrap();
        assert_eq!(bytes, vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]);
        let back = bytes_to_hex(&bytes);
        assert_eq!(back, "01 03 00 00 00 0A");
    }

    #[test]
    fn test_hex_to_bytes_no_spaces() {
        let hex = "01030000000A";
        let bytes = hex_to_bytes(hex).unwrap();
        assert_eq!(bytes, vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]);
    }

    #[test]
    fn test_hex_to_bytes_invalid_length() {
        let hex = "01030";
        let result = hex_to_bytes(hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_hex_to_bytes_invalid_chars() {
        let hex = "GG HH";
        let result = hex_to_bytes(hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_xor8() {
        let data = vec![0x01u8, 0x02, 0x03, 0x04];
        let result = compute_checksum(&data, ChecksumType::Xor8);
        assert_eq!(result, vec![0x04]); // 0x01 ^ 0x02 ^ 0x03 ^ 0x04 = 0x04
    }

    #[test]
    fn test_sum8() {
        let data = vec![0x01u8, 0x02, 0x03, 0x04];
        let result = compute_checksum(&data, ChecksumType::Sum8);
        assert_eq!(result, vec![0x0A]);
    }
}

pub fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    let cleaned: String = hex.chars().filter(|c| !c.is_whitespace()).collect();
    if cleaned.len() % 2 != 0 {
        return Err("十六进制字符串长度必须为偶数".to_string());
    }
    (0..cleaned.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&cleaned[i..i + 2], 16)
                .map_err(|e| format!("无效的十六进制字符: {}", e))
        })
        .collect()
}
