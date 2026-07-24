use crate::serial::types::*;
use chrono::Local;
use log::{debug, error, info};
use serialport::{DataBits as SerialDataBits, FlowControl as SerialFlowControl, Parity as SerialParity, StopBits as SerialStopBits, SerialPort, SerialPortInfo};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct PortManager {
    inner: Arc<Mutex<PortManagerInner>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

struct PortManagerInner {
    port: Option<Box<dyn SerialPort>>,
    port_name: String,
    config: PortConfig,
    bytes_sent: u64,
    bytes_received: u64,
}

impl PortManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(PortManagerInner {
                port: None,
                port_name: String::new(),
                config: PortConfig::default(),
                bytes_sent: 0,
                bytes_received: 0,
            })),
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut app = self.app_handle.lock().await;
        *app = Some(handle);
    }

    pub fn list_ports() -> Result<Vec<PortInfo>, String> {
        let ports = serialport::available_ports().map_err(|e| format!("枚举串口失败: {}", e))?;
        Ok(ports.into_iter().map(PortInfo::from).collect())
    }

    pub async fn open(
        &self,
        port_name: String,
        config: PortConfig,
    ) -> Result<(), String> {
        let mut inner = self.inner.lock().await;
        if inner.port.is_some() {
            return Err("已有打开的串口，请先关闭".to_string());
        }

        let port = Self::create_port(&port_name, &config)?;
        inner.port = Some(port);
        inner.port_name = port_name.clone();
        inner.config = config;
        inner.bytes_sent = 0;
        inner.bytes_received = 0;

        info!("串口已打开: {}", port_name);
        drop(inner);
        self.start_reading();
        Ok(())
    }

    pub async fn close(&self) -> Result<(), String> {
        let mut inner = self.inner.lock().await;
        inner.port = None;
        inner.port_name.clear();
        info!("串口已关闭");
        Ok(())
    }

    pub async fn write(&self, data: Vec<u8>, mode: WriteMode) -> Result<(), String> {
        let mut inner = self.inner.lock().await;
        let port = inner.port.as_mut().ok_or("串口未打开")?;

        let bytes_to_send = match mode {
            WriteMode::Text => data,
            WriteMode::Hex => {
                let hex_str = String::from_utf8_lossy(&data);
                Self::parse_hex_string(&hex_str)?
            }
        };

        port.write_all(&bytes_to_send)
            .map_err(|e| format!("写入失败: {}", e))?;
        port.flush().map_err(|e| format!("刷新失败: {}", e))?;

        inner.bytes_sent += bytes_to_send.len() as u64;

        let display_data = match mode {
            WriteMode::Text => String::from_utf8_lossy(&bytes_to_send).to_string(),
            WriteMode::Hex => bytes_to_send
                .iter()
                .map(|b| format!("{:02X}", b))
                .collect::<Vec<_>>()
                .join(" "),
        };

        let entry = LogEntry {
            timestamp: Local::now().format("%H:%M:%S%.3f").to_string(),
            direction: Direction::Tx,
            data: display_data,
            is_hex: matches!(mode, WriteMode::Hex),
        };
        drop(inner);
        self.emit_log(entry);

        debug!("TX: {:?}", bytes_to_send);
        Ok(())
    }

    pub async fn write_str(&self, text: &str, mode: WriteMode) -> Result<(), String> {
        self.write(text.as_bytes().to_vec(), mode).await
    }

    pub async fn get_status(&self) -> ConnectionStatus {
        let inner = self.inner.lock().await;
        ConnectionStatus {
            connected: inner.port.is_some(),
            port_name: inner.port_name.clone(),
            config: inner.config.clone(),
            bytes_sent: inner.bytes_sent,
            bytes_received: inner.bytes_received,
        }
    }

    #[allow(dead_code)]
    pub async fn is_connected(&self) -> bool {
        let inner = self.inner.lock().await;
        inner.port.is_some()
    }

    fn emit_log(&self, entry: LogEntry) {
        let app_handle = self.app_handle.clone();
        tokio::spawn(async move {
            let app = app_handle.lock().await;
            if let Some(handle) = app.as_ref() {
                let _ = handle.emit("serial:data", entry);
            }
        });
    }

    fn create_port(
        port_name: &str,
        config: &PortConfig,
    ) -> Result<Box<dyn SerialPort>, String> {
        let data_bits = match config.data_bits {
            DataBits::Five => SerialDataBits::Five,
            DataBits::Six => SerialDataBits::Six,
            DataBits::Seven => SerialDataBits::Seven,
            DataBits::Eight => SerialDataBits::Eight,
        };
        let stop_bits = match config.stop_bits {
            StopBits::One => SerialStopBits::One,
            StopBits::Two => SerialStopBits::Two,
        };
        let parity = match config.parity {
            Parity::None => SerialParity::None,
            Parity::Odd => SerialParity::Odd,
            Parity::Even => SerialParity::Even,
            Parity::Mark => SerialParity::None,  // serialport crate doesn't support Mark/Space
            Parity::Space => SerialParity::None,
        };
        let flow_control = match config.flow_control {
            FlowControl::None => SerialFlowControl::None,
            FlowControl::Software => SerialFlowControl::Software,
            FlowControl::Hardware => SerialFlowControl::Hardware,
        };

        serialport::new(port_name, config.baud_rate)
            .data_bits(data_bits)
            .stop_bits(stop_bits)
            .parity(parity)
            .flow_control(flow_control)
            .timeout(Duration::from_millis(100))
            .open()
            .map_err(|e| format!("打开串口 {} 失败: {}", port_name, e))
    }

    fn parse_hex_string(hex: &str) -> Result<Vec<u8>, String> {
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

    fn start_reading(&self) {
        let inner_arc = self.inner.clone();
        let app_handle = self.app_handle.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let mut buf = [0u8; 1024];
                loop {
                    let result = {
                        let mut inner = inner_arc.lock().await;
                        if inner.port.is_none() {
                            break;
                        }
                        inner.port.as_mut().unwrap().read(&mut buf)
                    };

                    match result {
                        Ok(n) if n > 0 => {
                            let data = buf[..n].to_vec();
                            let text = String::from_utf8_lossy(&data).to_string();

                            {
                                let mut inner = inner_arc.lock().await;
                                inner.bytes_received += n as u64;
                            }

                            let entry = LogEntry {
                                timestamp: Local::now().format("%H:%M:%S%.3f").to_string(),
                                direction: Direction::Rx,
                                data: text,
                                is_hex: false,
                            };

                            let app = app_handle.lock().await;
                            if let Some(handle) = app.as_ref() {
                                let _ = handle.emit("serial:data", entry);
                            }
                            debug!("RX: {} bytes", n);
                        }
                        Ok(_) => {
                            tokio::time::sleep(Duration::from_millis(10)).await;
                        }
                        Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                            tokio::time::sleep(Duration::from_millis(10)).await;
                        }
                        Err(e) => {
                            error!("读取串口错误: {}", e);
                            break;
                        }
                    }
                }
            });
        });
    }
}

impl From<SerialPortInfo> for PortInfo {
    fn from(info: SerialPortInfo) -> Self {
        let (port_type, pid, vid, serial_number, manufacturer, product) = match info.port_type {
            serialport::SerialPortType::UsbPort(usb) => (
                "USB".to_string(),
                Some(usb.pid),
                Some(usb.vid),
                usb.serial_number,
                usb.manufacturer,
                usb.product,
            ),
            serialport::SerialPortType::PciPort => ("PCI".to_string(), None, None, None, None, None),
            serialport::SerialPortType::Unknown => ("Unknown".to_string(), None, None, None, None, None),
            _ => ("Other".to_string(), None, None, None, None, None),
        };

        PortInfo {
            port_name: info.port_name,
            port_type,
            pid,
            vid,
            serial_number,
            manufacturer,
            product,
        }
    }
}
