# add-v2-ai-runtime — Tasks

## 1. Dependencies
- [x] `bun add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/deepseek @ai-sdk/openai-compatible @ai-sdk/provider gpt-tokenizer zod yaml` in server/

## 2. Provider Registry
- [x] 创建 `server/src/ai/providers.ts` — provider 工厂函数 (createOpenAI/createAnthropic/...) + resolveModel/resolveEmbeddingModel
- [x] 创建 `server/src/shared/config.ts` — config/app.yaml loader + template renderer + model registry
- [x] 验证: provider registry resolves models from config (typecheck pass)

## 3. Agent Tools
- [x] 创建 `server/src/ai/tools/index.ts` — tool 注册中心
- [x] 创建 `server/src/ai/tools/retrieve-sources.ts` — retrieveSources tool (sqlite-vec 检索)
- [x] 创建 `server/src/ai/tools/web-search.ts` — webSearch tool (SearXNG fetch)
- [x] 验证: tools typecheck pass (streamText integration deferred to qa-pipeline batch)

## 4. Structured Output
- [x] 创建 `server/src/ai/generate-output.ts` — generateObject wrapper + per-type Zod schema dispatch
- [x] 每种 output type 使用 Zod schema → generateObject → 校验返回
- [x] 验证: typecheck pass (live generateObject call deferred to outputs batch)

## 5. Streaming
- [x] 创建 `server/src/ai/stream.ts` — streamText → SSE relay 封装
- [x] Elysia 返回 ReadableStream + text/event-stream header
- [x] SSE event contract: chunk/state_snapshot/done/error (compatible with v1 frontend useChat.ts)
- [x] 验证: typecheck pass (live SSE stream deferred to qa-pipeline batch)

## 6. Middleware
- [x] 创建 `server/src/ai/middleware.ts` — retry middleware (3 retries, exponential backoff)
- [x] 包装 provider model: `wrapLanguageModel({middleware: {wrapGenerate, wrapStream}})`

## Verification
```bash
cd server
bun test src/ai/                     # AI runtime tests
bun run --cwd . dev & sleep 1
curl -N -X POST localhost:8032/v2/qa/stream -d '{"question":"hello"}'  # SSE stream
kill %1
```
