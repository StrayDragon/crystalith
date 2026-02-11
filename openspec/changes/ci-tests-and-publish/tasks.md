## 1. 主 CI workflow（PR + push）

- [ ] 1.1 新增 `.github/workflows/ci.yml`（或等价命名）：在 `push` 与 `pull_request` 上触发
- [ ] 1.2 配置 `paths-ignore`：仅修改 `docs/**`、`openspec/**`、`**/*.md` 等时不触发主 CI
- [ ] 1.3 后端 job：Setup Python + 安装 uv → `cd backend/py && uv sync --frozen` → `uv run pytest tests/ -v` + 运行 `backend/py/packages/*` 的 workspace 包测试
- [ ] 1.4 前端 job：Setup Node + 安装 pnpm → `cd frontend/web && pnpm install --frozen-lockfile` → `pnpm test` → `pnpm run build`
- [ ] 1.5 API consistency check：`cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json`
- [ ] 1.6 生成客户端一致性：`cd frontend/web && pnpm run api:generate` 后用 `git diff` 校验无未提交变更
- [ ] 1.7 为 uv/pnpm 添加缓存（避免每次全量下载），并在失败时保留足够日志便于定位

## 2. Python SDK 发布前置校验

- [ ] 2.1 在 `.github/workflows/release-python-sdk.yml` 增加 SDK freshness check（生成/校验无 diff）
- [ ] 2.2 确保 freshness check 失败时阻止 publish（Trusted Publishing 与 token fallback 均不执行）
- [ ] 2.3 复用/对齐 `check-python-sdk.yml` 的步骤（必要时抽取为可复用脚本或 composite action）
- [ ] 2.4 固定 Fern CLI 版本：将 workflows 中的 `npm install -g fern-api` 替换为 `npm install -g fern-api@3.73.1`

## 3. 文档与验证

- [ ] 3.1 在 `docs/sdk-python.md` 与/或顶层文档补充 CI 约束说明（何时需要更新 openapi.json 与生成客户端）
- [ ] 3.2 创建一个“故意失败”的测试 PR 验证 CI check 会正确失败并阻止合并
- [ ] 3.3 创建一个“仅改 docs”的 PR 验证主 CI 不触发（或被跳过），并确认 docs workflow（若存在）可覆盖文档构建验证
