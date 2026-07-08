---
depends_on: [c00-add-v2-server-foundation]
batch: all
---
# c02-add-v2-ai-runtime — AI 运行时：Vercel AI SDK 替换 pydantic-ai/pydantic-graph

## Why

v1 的 AI 层通过 pydantic-ai + pydantic-graph + langchain-community 组合实现 Agent Loop、结构化输出、工具调用、流式生成。v2 统一用 Vercel AI SDK (`ai` + `@ai-sdk/*`) 替代全部，减少 ~2000 行胶水代码，获得更好的 TypeScript 类型推断、官方维护的 Provider 生态和前端 hooks 集成。

## What Changes

- **NEW** `server/src/ai/` — provider 工厂、agent 工具注册、middleware
- **NEW** `@ai-sdk/openai` + `@ai-sdk/anthropic` + `@ai-sdk/google` + `@ai-sdk/deepseek` 等依赖
- **NEW** `gpt-tokenizer` 依赖替换 tiktoken
- **MODIFIED** `server/src/features/qa/` — QA pipeline 迁移到 AI SDK streamText + tools
- **MODIFIED** `server/src/features/outputs/` — 结构化输出迁移到 generateObject(schema: Zod)

## Capabilities

- architecture-plugin-and-agent (spec delta: 新增 AI SDK 运行时代替 pydantic-ai)

## Impact

- **BREAKING**: v1 AI 层 (`shared/ai/`, `shared/agents/`) 在 v2 不复存在，全新实现
- Provider 生态扩大：从 OpenAI-only 扩展到 Anthropic/Google/DeepSeek/Groq/xAI 等
- 前端可用 `ai/react` 的 `useChat` hook，或保持自管 SSE 消费
