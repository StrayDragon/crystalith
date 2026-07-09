# add-v2-citation-context-neighborhood — Tasks

- [ ] features/citations/context.ts 新增 resolveChunkContext(chunkId 或 source+index, neighbors)
- [ ] features/citations/router.ts 新增 GET /citations/context 端点 + 参数互斥校验 (400)
- [ ] 富化 page_number/paragraph_index 字段
- [ ] 复用现有 GET /citations/:messageId 不变
- [ ] bun test 新增 context 端点测试
- [ ] bun typecheck
