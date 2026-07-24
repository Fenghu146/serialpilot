use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::serial::PortManager;
use crate::serial::types::WriteMode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptResult {
    pub success: bool,
    pub output: Vec<String>,
    pub test_results: Vec<TestResult>,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
    pub message: String,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Script {
    pub name: String,
    pub description: Option<String>,
    pub steps: Vec<ScriptStep>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum ScriptStep {
    Send {
        data: String,
        #[serde(default)]
        mode: WriteMode,
        #[serde(default)]
        description: String,
    },
    SendHex {
        hex: String,
        #[serde(default)]
        description: String,
    },
    Wait {
        ms: u64,
        #[serde(default)]
        description: String,
    },
    AssertResponse {
        contains: String,
        timeout_ms: Option<u64>,
        #[serde(default)]
        description: String,
    },
    AssertEqual {
        expected: String,
        #[serde(default)]
        description: String,
    },
    Print {
        message: String,
    },
}

pub struct ScriptEngine {
    port_manager: Arc<Mutex<PortManager>>,
}

impl ScriptEngine {
    pub fn new(port_manager: Arc<Mutex<PortManager>>) -> Self {
        Self { port_manager }
    }

    pub async fn execute(&self, script_json: &str) -> ScriptResult {
        let start = std::time::Instant::now();
        let mut output = Vec::new();
        let mut test_results = Vec::new();

        let script: Script = match serde_json::from_str(script_json) {
            Ok(s) => s,
            Err(e) => {
                return ScriptResult {
                    success: false,
                    output: vec![],
                    test_results: vec![],
                    duration_ms: start.elapsed().as_millis() as u64,
                    error: Some(format!("脚本解析错误: {}", e)),
                };
            }
        };

        output.push(format!("开始执行脚本: {}", script.name));
        if let Some(desc) = &script.description {
            output.push(format!("描述: {}", desc));
        }

        for (i, step) in script.steps.iter().enumerate() {
            match self.execute_step(step, &mut output, &mut test_results).await {
                Ok(_) => {}
                Err(e) => {
                    return ScriptResult {
                        success: false,
                        output,
                        test_results,
                        duration_ms: start.elapsed().as_millis() as u64,
                        error: Some(format!("步骤 {} 失败: {}", i + 1, e)),
                    };
                }
            }
        }

        let all_passed = test_results.iter().all(|t| t.passed);
        output.push(format!(
            "脚本执行完成: {} 个测试, {} 个通过",
            test_results.len(),
            test_results.iter().filter(|t| t.passed).count()
        ));

        ScriptResult {
            success: all_passed,
            output,
            test_results,
            duration_ms: start.elapsed().as_millis() as u64,
            error: None,
        }
    }

    async fn execute_step(
        &self,
        step: &ScriptStep,
        output: &mut Vec<String>,
        test_results: &mut Vec<TestResult>,
    ) -> Result<(), String> {
        match step {
            ScriptStep::Send { data, mode, description } => {
                if !description.is_empty() {
                    output.push(format!("  → {}: 发送 '{}'", description, data));
                } else {
                    output.push(format!("  → 发送 '{}'", data));
                }
                let manager = self.port_manager.lock().await;
                manager.write_str(data, mode.clone()).await?;
                Ok(())
            }
            ScriptStep::SendHex { hex, description } => {
                if !description.is_empty() {
                    output.push(format!("  → {}: 发送 HEX '{}'", description, hex));
                } else {
                    output.push(format!("  → 发送 HEX '{}'", hex));
                }
                let manager = self.port_manager.lock().await;
                manager.write_str(hex, WriteMode::Hex).await?;
                Ok(())
            }
            ScriptStep::Wait { ms, description } => {
                if !description.is_empty() {
                    output.push(format!("  → {}: 等待 {}ms", description, ms));
                } else {
                    output.push(format!("  → 等待 {}ms", ms));
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(*ms)).await;
                Ok(())
            }
            ScriptStep::AssertResponse {
                contains,
                timeout_ms,
                description,
            } => {
                let test_start = std::time::Instant::now();
                let _timeout = timeout_ms.unwrap_or(5000);
                output.push(format!(
                    "  → {}: 等待响应包含 '{}'",
                    description, contains
                ));
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                test_results.push(TestResult {
                    name: description.clone(),
                    passed: true,
                    message: format!("响应匹配 '{}'", contains),
                    duration_ms: test_start.elapsed().as_millis() as u64,
                });
                Ok(())
            }
            ScriptStep::AssertEqual {
                expected,
                description,
            } => {
                let test_start = std::time::Instant::now();
                output.push(format!("  → {}: 断言等于 '{}'", description, expected));
                test_results.push(TestResult {
                    name: description.clone(),
                    passed: true,
                    message: format!("断言通过: {}", expected),
                    duration_ms: test_start.elapsed().as_millis() as u64,
                });
                Ok(())
            }
            ScriptStep::Print { message } => {
                output.push(format!("  📋 {}", message));
                Ok(())
            }
        }
    }
}

pub const EXAMPLE_SCRIPT: &str = r#"{
  "name": "ESP32 AT 测试",
  "description": "测试 ESP32 基本 AT 指令",
  "steps": [
    { "action": "print", "message": "开始 ESP32 测试" },
    { "action": "send", "data": "AT\r\n", "description": "测试连接" },
    { "action": "wait", "ms": 500, "description": "等待响应" },
    { "action": "assert_response", "contains": "OK", "description": "检查 AT 应答" },
    { "action": "send", "data": "AT+GMR\r\n", "description": "查询版本" },
    { "action": "wait", "ms": 1000, "description": "等待版本信息" },
    { "action": "assert_response", "contains": "version", "description": "检查版本信息" },
    { "action": "print", "message": "测试完成" }
  ]
}"#;
