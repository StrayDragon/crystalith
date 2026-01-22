## 1. 问题诊断

- [ ] 1.1 分析 sqlite-vss binding 缺失的根本原因
- [ ] 1.2 评估 sqlite-vss 与 Chroma 的优劣比较
- [ ] 1.3 确定最终技术方案

## 2. 方案 A：修复 sqlite-vss

- [ ] 2.1 安装 sqlite-vss 原生依赖（BLAS 库等）
- [ ] 2.2 更新 `pyproject.toml` 添加正确的依赖声明
- [ ] 2.3 验证向量搜索功能正常

## 3. 方案 B：切换到 Chroma（如方案 A 不可行）

- [ ] 3.1 添加 chromadb 依赖
- [ ] 3.2 实现 `ChromaVectorStorage` 类
- [ ] 3.3 更新 `VectorStorageFactory` 支持 Chroma
- [ ] 3.4 迁移现有数据（如需要）

## 4. 性能优化

- [ ] 4.1 添加向量搜索参数配置（top_k, similarity_threshold）
- [ ] 4.2 实现批量向量写入优化
- [ ] 4.3 添加索引预热机制

## 5. 测试与验证

- [ ] 5.1 向量存储性能基准测试（10k 向量搜索 < 100ms）
- [ ] 5.2 并发搜索压力测试
- [ ] 5.3 启动时无警告验证
