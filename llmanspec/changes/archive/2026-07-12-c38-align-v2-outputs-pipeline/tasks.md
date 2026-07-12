# align-v2-outputs-pipeline — Tasks

## 1. source_ids 接通检索链

- [x] `rag/registry.ts`: retrieveWith 参数类型改为 RetrieveOptions（含 sourceIds）
- [x] `rag/strategies/embed-strategy.ts`: retrieve 按 sourceIds 过滤 chunk（c40 searchVectors 已支持）
- [x] `features/outputs/pipeline.ts`: runOutputPipeline 接受 sourceIds 传给 retrieveWith
- [x] `features/outputs/router.ts`: POST /v2/outputs body 补 source_ids 字段透传

## 2. citation mapping

- [x] `features/outputs/pipeline.ts`: mapCitations — 检索 chunk → 完整 Citation 对象（含 source_name/page/paragraph）

## 3. postprocess

- [x] `features/outputs/pipeline.ts`: 实现 ensureMinimumContent（空内容 fallback）
- [x] `features/outputs/pipeline.ts`: 实现 sanitizeCitationsIndices（清理非法索引）
- [x] `features/outputs/pipeline.ts`: 生成失败时产出类型化 fallback 内容

## 4. export format

- [x] `features/outputs/render.ts`: 逐类型 markdown 渲染器（FAQ/TIMELINE/MINDMAP/QUIZ/BRIEFING/GUIDE/SLIDES/STRUCTURED/PARAGRAPH/BULLETS）
- [x] `features/outputs/router.ts`: export 端点读 query.format (markdown|json)
- [x] `features/outputs/router.ts`: json 路径返回 citations + sources + exported_at
- [x] `features/outputs/router.ts`: markdown 路径 — 逐类型渲染 + Content-Disposition header

## 5. convert-to-source

- [x] `features/outputs/router.ts`: convert-to-source 改用逐类型 markdown 渲染（非 JSON.stringify）
- [x] `features/outputs/router.ts`: 渲染后 500/50 分块 + embed

## 6. 请求字段补全

- [x] `features/outputs/pipeline.ts`: PipelineInput 补 model_id + top_k + min_score
- [x] `features/outputs/router.ts`: POST body 接受 top_k/min_score/model_id + set 201

## Verification

```bash
cd apps/server && bun test features/outputs
# source_ids 过滤测试（指定子集只检索该子集）
# citation mapping 测试（LLM 选的子集非全部）
# export markdown 逐类型渲染测试
# convert-to-source 分块测试
```
