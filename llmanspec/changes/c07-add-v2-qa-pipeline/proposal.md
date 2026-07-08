---
depends_on: [c04-add-v2-core-crud, c05-add-v2-rag-embed, c02-add-v2-ai-runtime]
batch: all
---

# c07-add-v2-qa-pipeline — QA 管线 (AI SDK streamText + RAG)

## Why

QA 是 Crystalith 的核心交互模式：用户在聊天面板提问 → RAG 检索 → LLM 生成回答 → 引用溯源 → 流式输出。v2 用 AI SDK streamText + tools (retrieveSources) 替代 v1 的手动检索拼接 + pydantic-ai Agent。

## What Changes

- **NEW** `server/src/features/qa/` — QA 端点 + agent 工具注册
- **NEW** `server/src/features/citations/` — 引用管理 (chunk → source/page 映射)
- **MODIFIED** `server/src/rag/` — retrieval 工具集成

## Capabilities

- chat-ui-envelope (spec delta: QA 流式对话端点)
- evidence-review-workflow (spec delta: 引用溯源)

## Impact

- Agent 自主决策何时检索（tool calling），不硬编码检索流水线
- 流式输出通过 SSE → 前端消费 text-delta/chunk-delta/citation 事件
