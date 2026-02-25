## 1. 本地 guardrails 入口（just）

- [x] 1.1 在根 `justfile` 增加 `check` 目标（fast checks）：后端 `check-imports`、config schema 一致性、OpenAPI schema check、前端生成客户端一致性检查
- [x] 1.2 在 `backend/py/justfile` 增加 `check`（或将 `test` 依赖补齐），并确保命令输出对开发者友好

## 2. CI 补齐 guardrails

- [x] 2.1 更新 `.github/workflows/ci.yml`：在 backend job 中增加 `cd backend/py && just check-imports`
- [x] 2.2 在 CI 中增加 config schema consistency：运行 `cd backend/py && just config-schema` 后 `git diff --exit-code config/app.schema.json`

## 3. pre-commit 按路径触发

- [x] 3.1 更新 `.pre-commit-config.yaml`：新增 `check-imports` hook（仅当 `backend/py/src/crystalith/**.py` 变更时触发）
- [x] 3.2 新增 config schema consistency hook（仅当 `backend/py/src/crystalith/shared/config/**` 或 `config/app.yaml` 变更时触发）
- [x] 3.3 保持现有 OpenAPI/前端 build hooks 不变，必要时优化其 files 过滤范围避免过慢

## 4. 验收

- [x] 4.1 本地运行：`just check`（应通过且无工作区未提交 diff）
- [x] 4.2 在 PR/CI 中验证：任意破坏 import 分层或 config schema 漂移的改动会被拦截并给出清晰失败信息
