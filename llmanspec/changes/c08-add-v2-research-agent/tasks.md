# add-v2-research-agent — Tasks

## 1. Research Tools

- [ ] `apps/server/src/features/research/tools.ts` — webSearch (SearXNG fetch), analyzeResults, writeReport
- [ ] ai() streamText + tools: {webSearch, analyzeResults, writeReport} + maxSteps=20

## 2. Research Sessions

- [ ] `apps/server/src/features/research/router.ts` — POST create, GET list, POST /:id/approve, POST /:id/stop
- [ ] Research session state: running → awaiting_approval → completed / stopped

## 3. Background Jobs

- [ ] `apps/server/src/features/tasks/queue.ts` — 简单 in-process 任务队列
- [ ] 前端 poll `/v2/tasks/:id` 获取进度

## 4. SearXNG Integration

- [ ] `fetch(searxngHost + '/search?q=...&format=json')` — 直接 HTTP API
- [ ] 解析 results: title, url (link), snippet (content)

## Verification

```bash
curl -X POST localhost:8032/v2/research -d '{"topic":"graphrag survey"}'
# wait + check progress
curl localhost:8032/v2/tasks/1
```
