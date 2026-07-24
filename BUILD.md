# 构建 SerialPilot 安装包

## 前置要求

### Windows
- Rust (https://www.rust-lang.org/tools/install)
- Node.js 20+
- Microsoft Visual Studio C++ 构建工具
- WebView2 Runtime (Windows 11 自带)

### macOS
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 20+

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## 构建步骤

```bash
# 1. 安装依赖
npm install

# 2. 构建发布版本
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`:
- Windows: `.msi` 安装包
- macOS: `.dmg` 镜像
- Linux: `.AppImage` / `.deb` 包

## 开发模式

```bash
npm run tauri:dev
```
