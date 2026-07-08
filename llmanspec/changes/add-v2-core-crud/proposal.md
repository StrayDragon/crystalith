---
depends_on: [add-v2-data-layer, add-v2-ai-runtime]
---
# add-v2-core-crud — Notebooks/Sessions/Messages/Sources 核心 CRUD

## Why

v1 的 94 个 API 端点分布 18 个 feature router 中，核心闭环涵盖 notebooks/sessions/messages/sources 的 CRUD 操作。这是用户使用 Crystalith 的前提：创建笔记本 → 上传资料 → 开始对话。v2 Elysia 重写实现，每个 feature 对应一个 router 模块。

## What Changes

- **NEW** `server/src/features/notebooks/` — CRUD + 列表
- **NEW** `server/src/features/sessions/` — 会话 CRUD
- **NEW** `server/src/features/messages/` — 消息列表 + 历史
- **NEW** `server/src/features/sources/` — 上传 + 解析 + 列表 + 搜索 + 删除
- **NEW** `server/src/features/sources/parsers/` — PDF (unpdf)、HTML (cheerio/readability)、Plain text parser
- **NEW** `unpdf` 依赖替换 pypdf

## Capabilities

- workspace-api-contract (spec delta: API 层从 FastAPI 迁移到 Elysia)
- source-ingestion-core (spec delta: parser 实现从 Python 迁移到 TS)
- source-ingestion-upload-and-url (spec delta: 上传/URL 端点)

## Impact

- **BREAKING**: API 前缀从 `/v1/` 变为 `/v2/`，响应格式从 Pydantic 变为 Zod 校验
- 前端 API 客户端需从 @hey-api/openapi-ts 生成迁移到 Elysia eden RPC
- PDF 解析质量已通过 benchmark 验证（5 样本：中文/英文/混合排版），unpdf 与 pypdf 文本提取一致
