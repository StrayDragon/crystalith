# add-v2-qa-pipeline — Tasks

## 1. QA Endpoint

- [ ] `apps/server/src/features/qa/router.ts` — POST /v2/qa (non-streaming), POST /v2/qa/stream (SSE streaming)
- [ ] `apps/server/src/features/qa/handler.ts` — streamText + retrieveSources tool 集成
- [ ] `apps/server/src/features/qa/presets.ts` — system prompt preset 管理

## 2. Citations

- [ ] `apps/server/src/features/citations/router.ts` — GET /v2/citations/:messageId 返回引用列表
- [ ] 前端 citation 渲染: chunk → source/page 映射

## 3. SSE Events

- [ ] SSE 事件类型: `text-delta`, `chunk-delta` (citation marker), `tool-call`, `tool-result`
- [ ] 前端 EventSource 消费并更新 UI

## 4. Non-Streaming

- [ ] POST /v2/qa 返回完整 {answer, citations, message_id}

## Verification

```bash
# Non-streaming:
curl -X POST localhost:8032/v2/qa -d '{"notebook_id":1,"session_id":1,"question":"test"}'
# Streaming:
curl -N -X POST localhost:8032/v2/qa/stream -d '{"notebook_id":1,"session_id":1,"question":"test"}'
```
