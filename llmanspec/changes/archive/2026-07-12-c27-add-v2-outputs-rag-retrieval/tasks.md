# add-v2-outputs-rag-retrieval — Tasks

- [x] outputs/pipeline.ts 改 getContext 用 ragRegistry.retrieveWith 替代 dump-all
- [x] outputs/generator.ts 构造 query (output 类型 + 主题)（buildOutputQuery）
- [x] 新增 GenerationPreference (quality/speed) 参数与 topK 映射（PREF_TOPK）
- [x] 检索结果转 citations 附到 OutputResult（buildCitationMap）
- [x] 保留显式 chunkIds 选择模式
- [x] bun test 新增 RAG 检索测试
- [x] bun typecheck
