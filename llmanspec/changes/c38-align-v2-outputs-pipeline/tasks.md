# align-v2-outputs-pipeline — Tasks

## 1. source_ids 接通检索链

- [ ] `rag/registry.ts`: RetrieveOptions 类型加 `sourceIds?: number[]`
- [ ] `rag/strategies/embed-strategy.ts`: retrieve 按 sourceIds 过滤 chunk
- [ ] `db/vectors.ts`: searchVectors 支持 sourceIds 过滤（或应用层 post-filter）
- [ ] `features/outputs/pipeline.ts`: runOutputPipeline 接受 sourceIds 传给 retrieveWith
- [ ] `features/outputs/router.ts`: POST /v2/outputs body 补 source_ids 字段透传

## 2. citation mapping

- [ ] `features/outputs/pipeline.ts`: 实现 mapCitations — LLM 输出的数字索引 → 完整 Citation 对象（非全部 chunk）

## 3. postprocess

- [ ] `features/outputs/pipeline.ts`: 实现 ensureMinimumContent（空内容 fallback）
- [ ] `features/outputs/pipeline.ts`: 实现 sanitizeCitationsIndices（清理非法索引）
- [ ] `features/outputs/pipeline.ts`: 生成失败时产出类型化 fallback 内容

## 4. export format

- [ ] `features/outputs/router.ts`: export 端点读 query.format (markdown|json)
- [ ] `features/outputs/router.ts`: json 路径返回 citations + sources + exported_at
- [ ] `features/outputs/router.ts`: markdown 路径 — 逐类型渲染器（FAQ/TIMELINE/MINDMAP/QUIZ/BRIEFING/GUIDE 等）
- [ ] `features/outputs/router.ts`: markdown Content-Disposition header

## 5. convert-to-source

- [ ] `features/outputs/router.ts`: convert-to-source 改用逐类型 markdown 渲染（非 JSON.stringify）
- [ ] `features/outputs/router.ts`: 渲染后 500/50 分块 + embed

## 6. 请求字段补全

- [ ] `packages/shared/src/schemas/output.ts`: OutputGenerateRequest 补 model_id + top_k + min_score
- [ ] `features/outputs/pipeline.ts`: 接受 top_k/min_score 传入检索（非 hardcoded PREF_TOPK）

## Verification

```bash
cd apps/server && bun test features/outputs
# source_ids 过滤测试（指定子集只检索该子集）
# citation mapping 测试（LLM 选的子集非全部）
# export markdown 逐类型渲染测试
# convert-to-source 分块测试
```
