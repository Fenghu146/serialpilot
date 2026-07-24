# SerialPilot - AI 协同串口调试工具

[![CI/CD](https://github.com/Fenghu146/serialpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/Fenghu146/serialpilot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-orange.svg)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.90+-orange.svg)](https://www.rust-lang.org)

> 面向嵌入式开发者的 AI 协同串口调试工具 — 替代传统串口助手

![SerialPilot](screenshot.png)

## ✨ 核心功能

### 🔌 传统串口终端
- 自动枚举本机串口设备，热插拔检测
- 完整通信参数配置（波特率/数据位/停止位/校验/流控）
- ASCII/HEX 双模式收发，定时发送，历史指令
- 实时滚动显示，时间戳精度毫秒级

### 🤖 AI 智能协同调试（核心特色）
- 内置 AI 对话面板，支持 OpenAI / Claude / Ollama / 自定义 API
- 日志选区提交 AI 分析，自动识别帧格式和异常
- 开发板自动识别（ESP32/Arduino/STM32 等）
- 自动生成测试指令，排查丢包/乱码/校验错误

### 📊 协议分析引擎
- Modbus RTU/TCP 帧解析，寄存器/线圈值解码
- AT 指令协议分析
- CRC8/16、XOR、SUM 校验计算
- 自动协议检测，异常告警

### 📝 脚本自动化
- JSON 格式测试脚本
- 支持 send/wait/assert 等步骤
- 一键运行，自动生成测试报告

### 🔄 日志导出与复盘
- 导出 TXT/CSV/JSON 格式
- 历史日志加载回放
- 播放速度控制，进度拖拽

### 🔌 MCP Server
- JSON-RPC 2.0 协议，端口 9777
- 9 个工具供外部 AI Agent 调用
- 支持 Claude Desktop / Cursor / VS Code Copilot

## 🚀 快速开始

### 环境要求
- [Rust](https://www.rust-lang.org/tools/install) 1.90+
- [Node.js](https://nodejs.org/) 20+
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (Windows)

### 开发模式
```bash
# 克隆仓库
git clone https://github.com/Fenghu146/serialpilot.git
cd serialpilot

# 安装依赖
npm install

# 启动开发服务器
npm run tauri:dev
```

### 生产构建
```bash
# 构建安装包
npm run tauri:build
```

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Tauri 2.0 (Rust) |
| 前端 | React 18 + TypeScript + TailwindCSS |
| 状态管理 | Zustand |
| 串口通信 | serialport crate |
| AI 集成 | OpenAI / Anthropic / Ollama API |
| 协议解析 | 纯 Rust 实现 |

## 📖 使用指南

### AI 配置
1. 点击右上角 ⚙ 设置图标
2. 选择 AI 服务商（OpenAI / Claude / Ollama / 自定义）
3. 输入 API Key 和模型名称
4. 在终端选中日志，右键提交 AI 分析

### MCP 集成
在 Claude Desktop 配置文件中添加：
```json
{
  "mcpServers": {
    "serialpilot": {
      "command": "nc",
      "args": ["127.0.0.1", "9777"]
    }
  }
}
```

### 脚本示例
```json
{
  "name": "ESP32 AT 测试",
  "steps": [
    { "action": "send", "data": "AT\r\n", "description": "测试连接" },
    { "action": "wait", "ms": 500 },
    { "action": "assert_response", "contains": "OK" }
  ]
}
```

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 协议

[MIT](LICENSE) License
