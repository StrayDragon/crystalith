# add-v2-outputs-rag-retrieval — Tasks

- [ ] outputs/pipeline.ts 改 getContext 用 ragRegistry.retrieveWith 替代 dump-all
- [ ] outputs/generator.ts 构造 query (output 类型 + 主题)
- [ ] 新增 GenerationPreference (quality/speed) 参数与 topK 映射
- [ ] 检索结果转 citations 附到 OutputResult
- [ ] 保留显式 chunkIds 选择模式
- [ ] bun test 新增 RAG 检索测试
- [ ] bun typecheck
