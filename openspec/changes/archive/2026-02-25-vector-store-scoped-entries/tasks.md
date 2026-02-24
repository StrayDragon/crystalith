## 1. VectorStore 接口扩展（notebook-scoped entries）

- [x] 1.1 扩展 `VectorStore` 协议的 `entries()` 签名：支持 `notebook_id`（可选）与 `source_ids`（可选）过滤参数，并保持无参调用兼容
- [x] 1.2 更新内置实现以支持过滤：`InMemoryVectorStore`、`SQLiteVectorStore`、`ChromaVectorStore`、`ChromaHttpVectorStore`（where 过滤 + 分页）以及任何包装层（如 cached wrapper）透传参数
- [x] 1.3 为 Chroma entries 实现添加后端过滤（where）以避免拉取全量 embeddings

## 2. Analysis API 改造（避免全量扫描）

- [x] 2.1 修改 `backend/py/src/crystalith/features/analysis/api.py`：使用 `entries(notebook_id=notebook_id)` 获取向量条目，删除“全量 list + 过滤”的路径
- [x] 2.2 回归验证：空 notebook 仍返回空数组；大 notebook 仍符合现有 `top_k/min_score/max_relations` 约束

## 3. 自动化测试

- [x] 3.1 为 `entries(notebook_id=...)` 增加单测（覆盖 memory/sqlite，并补充 chroma/chroma_http 的过滤行为）
- [x] 3.2 增加 analysis 端点回归测试：确保不会读取其他 notebook 的 entries（mock VectorStore 并断言调用参数）
- [x] 3.3 运行：`cd backend/py && just test`

## 4. 手动验收清单（部署后 + DevTools）

- [x] 4.1 提供部署后手动验收清单（DevTools）

### 部署后手动验收清单（DevTools / Network）

- 启动后端：`cd backend/py && uv sync && just dev`
- 前端进入 Workspace，打开 Analysis 面板触发 `/analysis` 请求
- 在浏览器 DevTools → Network 中确认仅请求当前 notebook 的 `/v1/notebooks/{id}/analysis`，响应 200 且返回结构符合 `AnalysisResult`
