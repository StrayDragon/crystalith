## Why

当前系统启动时显示 "sqlite-vss bindings 缺失" 警告，导致向量搜索 fallback 到暴力搜索模式。这在大规模数据场景下会导致严重的性能问题，影响 RAG 问答的响应速度。

## What Changes

- 解决 sqlite-vss 原生绑定问题，或切换到 Chroma 作为默认向量存储
- 添加向量存储性能基准测试
- 优化向量搜索配置参数

## Impact

- 受影响的规范：`vector-storage`
- 受影响的代码：
  - `backend/py/src/crystalith/vector_storage/sqlite.py`
  - `backend/py/src/crystalith/vector_storage/factory.py`
  - 可能新增 `backend/py/src/crystalith/vector_storage/chroma.py`
- 依赖关系：此变更为 T08（跨文档分析）提供高效向量搜索基础
