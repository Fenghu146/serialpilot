//! 串口生命周期管理：枚举、打开/关闭、写入、后台读取与收发统计。
//!
//! `PortManager` 通过内部 `Arc<Mutex<_>>` 实现可克隆的共享句柄，接收到的数据
//! 既通过 `serial:data` 事件推送给前端，也保留在内部接收缓冲区中，供脚本断言
//! 与 MCP `read`/`send_command` 工具读取。

use crate::serial::types::*;
use chrono::Local;
use log::{debug, error, info, warn};
use serialport::{DataBits as SerialDataBits, FlowControl as SerialFlowControl, Parity as SerialParity, StopBits as SerialStopBits, SerialPort, SerialPortInfo};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// 接收缓冲区上限（字节）。超出后丢弃最旧的数据，避免长时间运行导致内存膨胀。
const MAX_RX_BUFFER: usize = 256 * 1024;
/// 后台读取线程的轮询间隔。
const READ_POLL_INTERVAL: Duration = Duration::from_millis(10);
/// 串口读取超时。
const PORT_TIMEOUT: Duration = Duration::from_millis(100);
/// `wait_for_response` 的轮询间隔。
const RESPONSE_POLL_INTERVAL: Duration = Duration::from_millis(50);

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
    /// 自上次被消费以来累积的接收数据（原始字节）。
    rx_buffer: Vec<u8>,
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
                rx_buffer: Vec::new(),
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
        inner.rx_buffer.clear();

        info!("串口已打开: {} ({} baud)", port_name, inner.config.baud_rate);

        // 检查 app_handle 是否已设置
        let app = self.app_handle.lock().await;
        if app.is_none() {
            warn!("app_handle 尚未设置！emit_log 将无法发送数据到前端");
        }
        drop(app);

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
                crate::serial::checksum::hex_to_bytes(&hex_str)?
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

    /// 当前是否有串口处于打开状态。
    pub async fn is_connected(&self) -> bool {
        let inner = self.inner.lock().await;
        inner.port.is_some()
    }

    /// 取出并清空接收缓冲区中的原始字节。
    pub async fn take_received(&self) -> Vec<u8> {
        let mut inner = self.inner.lock().await;
        std::mem::take(&mut inner.rx_buffer)
    }

    /// 持续消费接收缓冲区并累积，直到 `predicate` 判定成功或超时。
    ///
    /// 返回 `(累计接收文本, 是否满足条件)`。该方法不会长时间持有外部锁，
    /// 调用方应在释放 `PortManager` 的共享锁后再调用它（可先 `clone()`）。
    pub async fn wait_until<F>(&self, timeout: Duration, mut predicate: F) -> (String, bool)
    where
        F: FnMut(&str) -> bool,
    {
        let deadline = Instant::now() + timeout;
        let mut accumulated = String::new();

        loop {
            let chunk = self.take_received().await;
            if !chunk.is_empty() {
                accumulated.push_str(&String::from_utf8_lossy(&chunk));
            }

            if predicate(&accumulated) {
                return (accumulated, true);
            }

            if Instant::now() >= deadline {
                return (accumulated, false);
            }
            tokio::time::sleep(RESPONSE_POLL_INTERVAL).await;
        }
    }

    /// 等待接收数据，直至满足条件或超时。
    ///
    /// - `needle` 为 `Some(s)` 时，累计文本包含 `s` 即视为成功；
    /// - `needle` 为 `None` 时，收到任意非空数据即视为成功。
    pub async fn wait_for_response(&self, needle: Option<&str>, timeout: Duration) -> (String, bool) {
        self.wait_until(timeout, |accumulated| match needle {
            Some(expected) => accumulated.contains(expected),
            None => !accumulated.is_empty(),
        })
        .await
    }

    fn emit_log(&self, entry: LogEntry) {
        let app_handle = self.app_handle.clone();
        tokio::spawn(async move {
            let app = app_handle.lock().await;
            if let Some(handle) = app.as_ref() {
                let _ = handle.emit("serial:data", entry);
            } else {
                error!("emit_log 失败: app_handle 未设置，数据丢失");
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
            .timeout(PORT_TIMEOUT)
            .open()
            .map_err(|e| format!("打开串口 {} 失败: {}", port_name, e))
    }

    fn start_reading(&self) {
        let inner_arc = self.inner.clone();
        let app_handle = self.app_handle.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);

                // Spawn the blocking read loop in a dedicated task
                let read_inner = inner_arc.clone();
                let read_handle = tokio::task::spawn_blocking(move || {
                    let mut buf = [0u8; 1024];
                    debug!("读取线程已启动，等待数据...");
                    loop {
                        let result = {
                            // Use blocking_lock since we're in a blocking context
                            let mut inner = read_inner.blocking_lock();
                            if inner.port.is_none() {
                                debug!("端口已关闭，读取线程退出");
                                break;
                            }
                            inner.port.as_mut().unwrap().read(&mut buf)
                        };

                        match result {
                            Ok(n) if n > 0 => {
                                let data = buf[..n].to_vec();
                                debug!("RX: read {} bytes: {:?}", n, &data);
                                if tx.blocking_send(data).is_err() {
                                    break; // Receiver dropped
                                }
                            }
                            Ok(_) => {
                                std::thread::sleep(READ_POLL_INTERVAL);
                            }
                            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                                // Timeout is normal, just continue
                            }
                            Err(e) => {
                                error!("读取串口错误: {}", e);
                                break;
                            }
                        }
                    }
                });

                // Process received data in async context
                while let Some(data) = rx.recv().await {
                    let text = String::from_utf8_lossy(&data).to_string();
                    let n = data.len();

                    debug!("RX: emit {} bytes: {}", n, text);

                    {
                        let mut inner = inner_arc.lock().await;
                        inner.bytes_received += n as u64;
                        inner.rx_buffer.extend_from_slice(&data);
                        if inner.rx_buffer.len() > MAX_RX_BUFFER {
                            let overflow = inner.rx_buffer.len() - MAX_RX_BUFFER;
                            inner.rx_buffer.drain(0..overflow);
                        }
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
                }

                read_handle.await.ok();
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
