# add-v2-research-agent — Tasks

## 1. Research Tools

- [x] `apps/server/src/features/research/tools.ts` — webSearch (SearXNG fetch), analyzeResults, writeReport
- [x] ai() streamText + tools: {webSearch, analyzeResults, writeReport}

## 2. Research Sessions

- [x] `apps/server/src/features/research/router.ts` — POST create, GET list, POST /:id/approve, POST /:id/stop
- [x] Research session state: running → awaiting_approval → completed / stopped

## 3. Background Jobs

- [x] Research agent runs fire-and-forget in background (in-process, no queue)
- [x] 前端 poll `/v2/tasks/:id` 获取进度 (research sessions API 已就绪，tasks CRUD 不在本批次范围)

## 4. SearXNG Integration

- [x] `fetch(searxngHost + '/search?q=...&format=json')` — 直接 HTTP API
- [x] 解析 results: title, url (link), snippet (content)

## Verification

```bash
curl -X POST localhost:8032/v2/research -d '{"topic":"graphrag survey"}'
# wait + check progress
curl localhost:8032/v2/tasks/1
```
