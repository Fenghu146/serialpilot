// Integration test for SerialPilot core logic
use serialpilot_lib::*;

fn main() {
    println!("=== SerialPilot Core Logic Test ===\n");

    // Test 1: Checksum computation
    println!("Test 1: Checksum Computation");
    let data = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A];
    let crc = checksum::compute_checksum(&data, ChecksumType::Crc16Modbus);
    println!("  Data: {:02X?}", data);
    println!("  CRC16-Modbus: {:02X?}", crc);
    assert_eq!(crc.len(), 2);
    println!("  ✓ PASSED\n");

    // Test 2: Hex conversion
    println!("Test 2: Hex Conversion");
    let hex = "01 03 00 00 00 0A";
    let bytes = checksum::hex_to_bytes(hex).unwrap();
    println!("  Hex: {}", hex);
    println!("  Bytes: {:02X?}", bytes);
    assert_eq!(bytes, vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]);
    let back = checksum::bytes_to_hex(&bytes);
    println!("  Back to hex: {}", back);
    assert_eq!(back, "01 03 00 00 00 0A");
    println!("  ✓ PASSED\n");

    // Test 3: Modbus RTU parsing
    println!("Test 3: Modbus RTU Frame Parsing");
    // Read holding registers: slave=1, fc=03, addr=0x0000, qty=0x000A, CRC
    let modbus_frame = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xCD, 0xCB];
    let analysis = ProtocolAnalyzer::new().analyze(&modbus_frame, Some("modbus_rtu"));
    println!("  Raw: {:02X?}", modbus_frame);
    println!("  Protocol: {}", analysis.protocol);
    println!("  Fields:");
    for field in &analysis.fields {
        println!("    {}: {} ({})", field.name, field.value, field.description);
    }
    assert_eq!(analysis.protocol, "Modbus RTU");
    assert!(analysis.checksum_valid.unwrap_or(false));
    println!("  ✓ PASSED\n");

    // Test 4: Modbus TCP parsing
    println!("Test 4: Modbus TCP Frame Parsing");
    let modbus_tcp = vec![0x00u8, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
    let analysis = ProtocolAnalyzer::new().analyze(&modbus_tcp, Some("modbus_tcp"));
    println!("  Raw: {:02X?}", modbus_tcp);
    println!("  Protocol: {}", analysis.protocol);
    for field in &analysis.fields {
        println!("    {}: {} ({})", field.name, field.value, field.description);
    }
    assert_eq!(analysis.protocol, "Modbus TCP");
    println!("  ✓ PASSED\n");

    // Test 5: AT command parsing
    println!("Test 5: AT Command Parsing");
    let at_cmd = b"AT\r\n";
    let analysis = ProtocolAnalyzer::new().analyze(at_cmd, Some("at_command"));
    println!("  Raw: {:?}", String::from_utf8_lossy(at_cmd));
    println!("  Protocol: {}", analysis.protocol);
    for field in &analysis.fields {
        println!("    {}: {} ({})", field.name, field.value, field.description);
    }
    assert_eq!(analysis.protocol, "AT Command");
    println!("  ✓ PASSED\n");

    // Test 6: AT response parsing
    println!("Test 6: AT Response Parsing");
    let at_resp = b"AT+GMR\r\nOK\r\n";
    let analysis = ProtocolAnalyzer::new().analyze(at_resp, Some("at_command"));
    println!("  Raw: {:?}", String::from_utf8_lossy(at_resp));
    println!("  Protocol: {}", analysis.protocol);
    for field in &analysis.fields {
        println!("    {}: {} ({})", field.name, field.value, field.description);
    }
    assert_eq!(analysis.protocol, "AT Command");
    println!("  ✓ PASSED\n");

    // Test 7: Auto-detect protocol
    println!("Test 7: Auto-detect Protocol");
    let analysis = ProtocolAnalyzer::new().analyze(&modbus_frame, None);
    println!("  Raw: {:02X?}", modbus_frame);
    println!("  Detected: {}", analysis.protocol);
    assert_eq!(analysis.protocol, "Modbus RTU");
    println!("  ✓ PASSED\n");

    // Test 8: Empty data handling
    println!("Test 8: Empty Data Handling");
    let empty: Vec<u8> = vec![];
    let analysis = ProtocolAnalyzer::new().analyze(&empty, None);
    println!("  Raw: (empty)");
    println!("  Protocol: {}", analysis.protocol);
    assert_eq!(analysis.protocol, "Empty");
    assert!(!analysis.anomalies.is_empty());
    println!("  ✓ PASSED\n");

    // Test 9: CRC verification
    println!("Test 9: CRC Verification");
    let frame_with_crc = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xCD, 0xCB];
    let computed_crc = checksum::compute_checksum(&frame_with_crc[..frame_with_crc.len()-2], ChecksumType::Crc16Modbus);
    let expected_crc = &frame_with_crc[frame_with_crc.len()-2..];
    println!("  Computed CRC: {:02X?}", computed_crc);
    println!("  Expected CRC: {:02X?}", expected_crc);
    assert_eq!(computed_crc, expected_crc);
    println!("  ✓ PASSED\n");

    // Test 10: Modbus CRC validation
    println!("Test 10: Modbus CRC Validation");
    let valid_frame = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xCD, 0xCB];
    let analysis = ProtocolAnalyzer::new().analyze(&valid_frame, Some("modbus_rtu"));
    assert_eq!(analysis.checksum_valid, Some(true));
    println!("  Valid frame CRC check: {:?}", analysis.checksum_valid);
    
    let invalid_frame = vec![0x01u8, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xFF, 0xFF];
    let analysis = ProtocolAnalyzer::new().analyze(&invalid_frame, Some("modbus_rtu"));
    assert_eq!(analysis.checksum_valid, Some(false));
    println!("  Invalid frame CRC check: {:?}", analysis.checksum_valid);
    println!("  ✓ PASSED\n");

    println!("=== All 10 Tests Passed ===");
}
