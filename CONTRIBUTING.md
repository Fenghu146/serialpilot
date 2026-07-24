# 贡献指南

感谢你对 SerialPilot 的兴趣！

## 开发流程

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 代码规范

### Rust
- 遵循 `rustfmt` 格式化
- 使用 `clippy` 检查: `cargo clippy`
- 运行测试: `cargo test`

### TypeScript/React
- 使用 TailwindCSS 工具类
- 组件文件使用 PascalCase
- 遵循现有代码风格

## 提交信息格式

```
feat: 新功能
fix: 修复
docs: 文档
refactor: 重构
test: 测试
chore: 构建/工具
```

## 测试

```bash
# Rust 测试
cd src-tauri && cargo test

# TypeScript 检查
npx tsc --noEmit

# 前端构建
npm run build
```
