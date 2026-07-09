# fix-v2-outputs-and-refine — Tasks

## 1. 补 3 种 core output generator

- [x] `features/outputs/generator.ts`: OUTPUT_META 补 PARAGRAPH/BULLETS/STRUCTURED + prompt
- [x] 确认 generateObject 用 OutputContentSchemaByType[type]（shared 已有 schema）
- [x] 验证: `bun test test/outputs/core-types.test.ts`（3 类型不 throw，返回符合 schema）

## 2. Postprocess

- [x] 新建 `features/outputs/postprocess.ts`: ensure_minimum_content + sanitize_citations_indices
- [x] pipeline.ts 调 postprocessOutput（generateObject 后）
- [x] 验证: `bun test test/outputs/postprocess.test.ts`（缺字段补 fallback、citation index clamp）

## 3. Output 转 Source

- [x] `features/outputs/router.ts`: convert-to-source 后 embed + 写 vec_chunks
- [x] 验证: 转换后的源可被语义检索命中

## 4. Refine source 过滤

- [x] `features/refine/router.ts`: 查询加 inArray(chunks.sourceId, sourceIds)
- [x] 验证: `bun test test/refine/source-filter.test.ts`（只 refine 指定 source_ids）

## 5. Refine structured 模式 + 异步 ✅

- [x] `features/refine/router.ts`: 补 structured 模式 + 改为 task queue 异步（factory 函数，enqueue + waitForCompletion）

## 6. 整体验证

- [x] `cd apps/server && bun test tests/bdd/`（outputs/refine 相关 BDD）
- [x] `bun oxlint apps/server/src/features/outputs/ apps/server/src/features/refine/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/          # outputs/refine BDD
bun oxlint apps/server/src/features/outputs/ apps/server/src/features/refine/
```
