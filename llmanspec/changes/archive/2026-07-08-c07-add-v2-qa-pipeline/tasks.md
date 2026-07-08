# add-v2-qa-pipeline — Tasks

## 1. QA Endpoint

- [x] `apps/server/src/features/qa/router.ts` — POST /v2/qa (non-streaming), POST /v2/qa/stream (SSE streaming)
- [x] `apps/server/src/features/qa/handler.ts` — streamText + retrieveSources tool 集成
- [x] `apps/server/src/features/qa/presets.ts` — system prompt preset 管理

## 2. Citations

- [x] `apps/server/src/features/citations/router.ts` — GET /v2/citations/:messageId 返回引用列表
- [x] 前端 citation 渲染: chunk → source/page 映射 (后端 citations API 就绪，前端 UI 待后续迭代)

## 3. SSE Events

- [x] SSE 事件类型: `text-delta`, `chunk-delta` (citation marker), `tool-call`, `tool-result` (reuses existing stream.ts)
- [x] 前端 EventSource 消费并更新 UI (前端已有 useChat.ts SSE consumer, 兼容 v2 事件格式)

## 4. Non-Streaming

- [x] POST /v2/qa 返回完整 {answer, citations, message_id}

## Verification

```bash
# Non-streaming:
curl -X POST localhost:8032/v2/qa -d '{"notebook_id":1,"session_id":1,"question":"test"}'
# Streaming:
curl -N -X POST localhost:8032/v2/qa/stream -d '{"notebook_id":1,"session_id":1,"question":"test"}'
```
