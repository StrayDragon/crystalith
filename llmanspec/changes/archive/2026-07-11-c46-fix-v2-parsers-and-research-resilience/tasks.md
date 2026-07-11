# fix-v2-parsers-and-research-resilience — Tasks

## 1. CSV 专用 parser

- [x] `features/sources/parsers/csv.ts`: 实现 CSVParser（markdown-table 分块 50 rows/chunk + 200 char cell 截断 + csv_row metadata）
- [x] `features/sources/parser-registry.ts`: 注册 csv parser（.csv → CSVParser 而非 textParser）
- [x] `features/sources/parsers/text.ts`: 移除 csv 的 MIME/extension claim
- [x] `features/sources/pipeline.ts`: 注册 csvParser（在 textParser 之前）

## 2. research report 富 prompt

- [x] `features/research/agent.ts`: 采用 v1 REPORT_SYSTEM_PROMPT（6 段结构化模板）

## 3. AI 失败 fallback

- [x] `features/research/agent.ts`: planSearches 失败 → fallback 2-query plan（非 break loop）
- [x] `features/research/agent.ts`: analyzeResults 失败 → coverage fallback analysis（非 break loop）

## 4. lock 续期

- [x] `features/research/router.ts`: 导出 renewLock 函数
- [x] `features/research/agent.ts`: agent loop 每次迭代续期 lock

## 5. search dedup 增强

- [x] `features/research/agent.ts`: normalizeUrl strip trailing slash / www.
- [x] `features/research/agent.ts`: titleSimilarity word-overlap ≥ 0.85 过滤

## Verification

```bash
cd apps/server && bun typecheck  # ✅ pass
cd apps/server && bun test       # ✅ 209 pass / 2 fail (network timeout, no regression)
```

## 未做（P1 但依赖较多/影响小，可后置）

- export note 类型 STRUCTURED + content shape：需改 output schema，影响面大
- finish 后台生成 report：当前同步生成可用，后台化为架构改进
- waiting SSE 心跳：需改 stream loop 逻辑，当前单次 waiting 可用
