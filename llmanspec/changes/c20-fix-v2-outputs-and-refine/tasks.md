# fix-v2-outputs-and-refine — Tasks

## 1. 补 3 种 core output generator

- [ ] `features/outputs/generator.ts`: OUTPUT_META 补 PARAGRAPH/BULLETS/STRUCTURED + prompt
- [ ] 确认 generateObject 用 OutputContentSchemaByType[type]（shared 已有 schema）
- [ ] 验证: `bun test test/outputs/core-types.test.ts`（3 类型不 throw，返回符合 schema）

## 2. 后处理

- [ ] 新建 `features/outputs/postprocess.ts`: ensure_minimum_content + sanitize_citations_indices
- [ ] pipeline.ts 调 postprocessOutput（generateObject 后）
- [ ] 验证: `bun test test/outputs/postprocess.test.ts`（缺字段补 fallback、citation index clamp）

## 3. convert-to-source embed

- [ ] `features/outputs/router.ts`: convert-to-source 后 embed + 写 vec_chunks
- [ ] 验证: 转换后的源可被语义检索命中

## 4. refine source_ids bug

- [ ] `features/refine/router.ts`: 查询加 inArray(chunks.sourceId, sourceIds)
- [ ] 验证: `bun test test/refine/source-filter.test.ts`（只 refine 指定 source_ids）

## 5. refine 格式对齐 + 队列化

- [ ] `features/refine/router.ts`: 补 structured 模式（返回 {title, bullets[], terms[]}）
- [ ] refine 经 c19 任务队列异步执行（enqueue → wait → 409 on cancelled）
- [ ] 验证: `bun test test/refine/`（structured 格式 + 异步执行）

## 6. 整体验证

- [ ] `cd apps/server && bun test tests/bdd/`（outputs/refine 相关 BDD）
- [ ] `bun oxlint apps/server/src/features/outputs/ apps/server/src/features/refine/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/    # outputs/refine 域
bun test test/outputs/ test/refine/
bun oxlint apps/server/src/features/outputs/ apps/server/src/features/refine/
```
