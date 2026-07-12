# add-v2-citation-context-neighborhood — Tasks

- [x] features/citations/context.ts 新增 resolveChunkContext(chunkId 或 source+index, neighbors)
- [x] features/citations/router.ts 新增 GET /notebooks/:nid/citations/context 端点 + 参数互斥校验 (400)（c53 路径修正：从扁平 /citations/context 改回嵌套 /notebooks/:nid/citations/context）
- [x] 富化 page_number/paragraph_index 字段
- [x] 复用现有 GET /citations/:messageId 不变
- [x] bun test 新增 context 端点测试（test/citations/context.test.ts，12 tests）
- [x] bun typecheck
