## 1. 配置与依赖

- [x] 1.1 更新 `backend/py/pyproject.toml`：移除 sqlite-vss，新增 chromadb 依赖
- [x] 1.2 更新 `backend/py/uv.lock`
- [x] 1.3 更新配置模型：默认 `vector_storage.provider=chroma`，新增 `vector_storage.chroma.path`，`sqlite` 作为本地 Chroma 的兼容别名
- [x] 1.4 更新 `config/app.yaml` 默认值（保持在 `./data` 目录）
- [x] 1.5 默认关闭 Chroma 遥测并提供配置项

## 2. 本地 Chroma VectorStore

- [x] 2.1 新增 `ChromaVectorStore` 实现（嵌入式 `PersistentClient`）
- [x] 2.2 统一 ID/metadata 规则（notebook_id/source_id/chunk_id），覆盖 add/search/remove/entries
- [x] 2.3 更新 `VectorStorageFactory`：provider=chroma 正常创建；provider=sqlite 映射到本地 Chroma 实现

## 3. 迁移与兼容

- [x] 3.1 迁移工具：从 `./data/vectors.db` 读取旧数据写入 Chroma
- [x] 3.2 迁移验证：同一 notebook/source 的 chunk 可检索
- [x] 3.3 提供迁移验证脚本（抽样核对）

## 4. 测试与验证

- [x] 4.1 新增 Chroma 本地存储单测（add/search/remove/entries）
- [x] 4.2 新增 SQLite→Chroma 迁移单测
- [x] 4.3 更新/删除依赖 sqlite-vss 的测试
- [x] 4.4 启动检查：无 sqlite-vss 警告；provider=sqlite 仍可正常启动
- [x] 4.5 运行 `cd backend/py && just test`
