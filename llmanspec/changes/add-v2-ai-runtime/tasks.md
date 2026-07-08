# add-v2-ai-runtime — Tasks

## 1. Dependencies
- [ ] `bun add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/deepseek gpt-tokenizer zod` in server/

## 2. Provider Registry
- [ ] 创建 `server/src/ai/providers.ts` — provider 工厂函数 (createOpenAI/createAnthropic/...)
- [ ] 创建 `server/src/ai/model-registry.ts` — modelId → provider instance 映射
- [ ] 验证: 调用 `openai("gpt-4o")` + `generateText({prompt: "hello"})` 返回结果

## 3. Agent Tools
- [ ] 创建 `server/src/ai/tools/index.ts` — tool 注册中心
- [ ] 创建 `server/src/ai/tools/retrieve-sources.ts` — retrieveSources tool (sqlite-vec 检索)
- [ ] 创建 `server/src/ai/tools/web-search.ts` — webSearch tool (SearXNG fetch)
- [ ] 验证: `streamText({tools: {retrieveSources}, maxSteps: 3})` agent loop 自主调用工具

## 4. Structured Output
- [ ] 创建 `server/src/ai/generate-output.ts` — generateObject wrapper
- [ ] 每种 output type 使用 Zod schema → generateObject → 校验返回
- [ ] 验证: FAQ schema → generateObject → 返回符合 Zod 的 JSON

## 5. Streaming
- [ ] 创建 `server/src/ai/stream.ts` — streamText → SSE relay 封装
- [ ] Elysia 返回 ReadableStream + text/event-stream header
- [ ] 前端 EventSource 消费 SSE 事件
- [ ] 验证: `curl -N localhost:8032/v2/qa/stream` 看到 text-delta 事件

## 6. Middleware
- [ ] 创建 `server/src/ai/middleware.ts` — retry middleware (3 retries, exponential backoff)
- [ ] 包装 provider model: `wrapLanguageModel({middleware: {wrapGenerate}})` 

## Verification
```bash
cd server
bun test src/ai/                     # AI runtime tests
bun run --cwd . dev & sleep 1
curl -N -X POST localhost:8032/v2/qa/stream -d '{"question":"hello"}'  # SSE stream
kill %1
```

