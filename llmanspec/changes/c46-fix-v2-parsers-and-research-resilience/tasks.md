# fix-v2-parsers-and-research-resilience — Tasks

## 1. CSV 专用 parser

- [ ] `features/sources/parsers/csv.ts`: 实现 CSVParser（markdown-table 分块 50 rows/chunk + 200 char cell 截断 + csv_row_start/end metadata）
- [ ] `features/sources/parser-registry.ts`: 注册 csv parser（.csv → CSVParser 而非 textParser）

## 2. research report 富 prompt

- [ ] `features/research/agent.ts:508`: 采用 v1 REPORT_SYSTEM_PROMPT（6 段结构化模板）
- [ ] 实现 fallback report（生成失败时）

## 3. AI 失败 fallback

- [ ] `features/research/agent.ts:311`: planSearches 失败 → fallback 2-query plan（非 break loop）
- [ ] `features/research/agent.ts:358`: analyzeResults 失败 → coverage fallback analysis（非 break loop）

## 4. export note 类型对齐

- [ ] `features/research/router.ts:665-670`: export note 用 type=STRUCTURED + {title,text,metadata}（非 BRIEFING + sections）

## 5. finish 后台生成 report

- [ ] `features/research/router.ts:544-550`: finish 只翻状态，report 由 agent 异步生成（非同步阻塞）

## 6. waiting SSE 心跳

- [ ] `features/research/router.ts:833`: stream loop 中 status=waiting_user 时每次 poll 重发 waiting 事件

## 7. lock 续期

- [ ] `features/research/agent.ts`: agent loop 中每 5min 续期 lock（更新 lockExpiresAt）

## 8. search dedup 增强

- [ ] `features/research/agent.ts:246`: deduplicateResults 增加 strip trailing slash / www. + 标题相似度 ≥0.85 过滤

## Verification

```bash
cd apps/server && bun test features/research features/sources
# CSV 产出 markdown-table 分块 + csv_row metadata
# report 含 6 段结构
# plan 失败时 fallback 继续（非中止）
# waiting 事件定期重发
```
