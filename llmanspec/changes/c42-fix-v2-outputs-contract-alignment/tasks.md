# fix-v2-outputs-contract-alignment — Tasks

## 1. POST 返回 OutputRead 契约

- [ ] `features/outputs/router.ts`: serializeOutput 已存在 — 确认 POST handler 返回 serializeOutput(row) 而非 PipelineResult
- [ ] `features/outputs/pipeline.ts`: runOutputPipeline 返回 { row, citations, warnings }，row 为已持久化的 outputs 行
- [ ] 确认 serializeOutput 输出 snake_case：id/notebook_id/type/prompt/chunk_ids/content/created_at/updated_at

## 2. citation 递归映射进 content 并持久化

- [ ] `features/outputs/pipeline.ts`: 实现 mapCitationsIntoContent(content, citationMap) — 递归遍历，把 citations:[1,3] 替换为完整 Citation dict（v1 _map_citations 等价）
- [ ] `features/outputs/pipeline.ts`: 持久化映射后的 content 到 outputs.content（非裸整数）
- [ ] `features/outputs/pipeline.ts`: 仍返回扁平 citations 数组供响应使用

## 3. RAG 失败传播错误

- [ ] `features/outputs/pipeline.ts:103-120`: 移除 dump 全量 chunks 兜底，让 retrieveWith 错误传播

## 4. 字段级 postprocess

- [ ] `features/outputs/pipeline.ts`: ensureMinimumContent 改为逐类型逐字段补默认（GUIDE examples/exercises、MINDMAP children、BRIEFING points、TIMELINE events 等）
- [ ] `features/outputs/pipeline.ts`: fallback 内容加 `_fallback: true` 标记 + 全类型覆盖

## 5. export 字段补全

- [ ] `features/outputs/router.ts`: JSON export citations 补 chunk_index/page_number/paragraph_index/score
- [ ] `features/outputs/router.ts`: sources 改为 {source_id, source_name, mime_type, parser_type}

## 6. 错误码细分

- [ ] `features/outputs/router.ts`: model 不可用 → 503；schema 校验失败 → 422；值错误 → 400

## Verification

```bash
cd apps/server && bun test features/outputs
# POST 返回 OutputRead（含 created_at/notebook_id）
# content 树中 citations 为完整对象非裸整数
# RAG 失败时请求失败而非 dump 全量
# export JSON citations 含 chunk_index/page_number
```
