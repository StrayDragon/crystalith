## Why

当前 `SQLiteVectorStore` 依赖 sqlite-vss，环境中缺失绑定时会降级为暴力搜索，带来性能和稳定性问题。我们需要一个完全本地、无需部署服务的向量存储方案。

## What Changes

- **BREAKING**：本地向量存储从 sqlite-vss 切换为嵌入式 Chroma 持久化（无需服务端）。
- 默认使用 `vector_storage.provider: chroma`，持久化路径放在当前 `./data` 目录下（例如 `./data/chroma`）。
- `vector_storage.provider: sqlite` 保持兼容，但内部映射为本地 Chroma 持久化实现。
- 移除 sqlite-vss 依赖与加载逻辑，仅保留旧 SQLite 读取能力用于迁移。

## Impact

- 受影响的规范：`vector-storage`
- 受影响的代码：
  - `backend/py/src/crystalith/vector_storage/`
  - `backend/py/src/crystalith/config/models.py`
  - `backend/py/src/crystalith/config/manager.py`
  - `config/app.yaml`
  - `backend/py/tests/test_vector_storage.py`
- 数据迁移：现有 `./data/vectors.db` 需要迁移到 Chroma 持久化目录。
