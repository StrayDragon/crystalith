## 1. GitHub Actions 基础配置

- [ ] 1.1 创建 `.github/workflows/ci.yml`
- [ ] 1.2 配置触发条件（PR、push to main）
- [ ] 1.3 配置缓存（uv cache、pnpm cache）

## 2. 后端 CI 步骤

- [ ] 2.1 Python 环境设置（uv sync）
- [ ] 2.2 类型检查（mypy / pyright，如已配置）
- [ ] 2.3 单元测试运行（pytest）
- [ ] 2.4 API Schema 验证

## 3. 前端 CI 步骤

- [ ] 3.1 Node.js 环境设置（pnpm install）
- [ ] 3.2 类型检查（tsc --noEmit）
- [ ] 3.3 单元测试运行（pnpm test）
- [ ] 3.4 生产构建验证（pnpm build）

## 4. 分支保护

- [ ] 4.1 配置 main 分支保护规则
- [ ] 4.2 要求 CI 通过才能合并
- [ ] 4.3 要求至少 1 个 review（可选）

## 5. 文档更新

- [ ] 5.1 README 添加 CI status badge
- [ ] 5.2 添加贡献指南说明 CI 要求
