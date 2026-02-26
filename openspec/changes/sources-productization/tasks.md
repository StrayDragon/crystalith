## 1. 失败诊断字段与错误码体系

- [x] 1.1 为 Source 增加失败诊断字段（error_code/error_message/recovery_hint/last_error_at）并完成 alembic 迁移。
- [x] 1.2 在 ingestion/解析/索引管道中为失败路径映射稳定 error_code，并确保错误信封与 source 字段一致。
- [x] 1.3 更新 sources list/get API 响应：失败态时返回诊断字段（可选/非破坏性）。

## 2. 批量操作语义强化

- [x] 2.1 为批量删除/批量 re-embed/tag 绑定端点补齐逐项结果结构（成功/失败/error_code）。
- [x] 2.2 校验 epoch bump 规则：成功变更后 bump；失败不产生不必要的 bump。

## 3. 去重策略（可选）

- [x] 3.1 定义 dedup_key 计算策略（upload/url），并增加开关配置（默认关闭，prod/dev 不区分）。
- [x] 3.2 增加去重命中后的交互契约（复用/仍创建）与 UI 提示文案。

## 4. UI 与文档

- [x] 4.1 Sources 面板展示失败原因与 recovery_hint，并提供重试/排障入口。
- [x] 4.2 文档补齐“导入失败排障”与“去重策略说明”。

## 5. Verification

- [x] 5.1 `cd backend/py && just test`
- [x] 5.2 `cd frontend/web && pnpm test`
- [x] 5.3 `cd backend/py && uv run python scripts/api_schema.py export -o ../../frontend/web/openapi.json`（如 OpenAPI 变更）

### Results (2026-02-27)

- Backend: `just test` (26 passed)
- Frontend: `pnpm test` (83 passed)
- OpenAPI sync: `cd frontend/web && pnpm run api:sync`
