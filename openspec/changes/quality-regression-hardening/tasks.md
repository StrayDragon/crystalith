## 1. Python lint（增量）

- [ ] 1.1 评估并选择 lint 工具（ruff 或等价），新增配置与本地入口（例如 `cd backend/py && just lint`）。
- [ ] 1.2 采用增量策略接入 CI（仅 error 级别 blocking 或仅对变更文件）。

## 2. Frontend lint（增量）

- [ ] 2.1 增加前端 lint 配置与脚本（eslint/biome 二选一，优先最小侵入）。
- [ ] 2.2 接入 CI 与本地入口（例如 `cd frontend/web && pnpm run lint`）。

## 3. API contract tests

- [ ] 3.1 为关键端点补齐 contract tests（错误信封、citations、workspace tools schema 等）。
- [ ] 3.2 将 contract tests 纳入后端测试入口或独立 gate。

## 4. Docs

- [ ] 4.1 更新贡献指南：本地检查入口与 CI gate 说明。

## 5. Verification

- [ ] 5.1 `cd backend/py && just test`
- [ ] 5.2 `cd frontend/web && pnpm test`
- [ ] 5.3 CI: 通过新增 lint/contract gate（按选定策略）
