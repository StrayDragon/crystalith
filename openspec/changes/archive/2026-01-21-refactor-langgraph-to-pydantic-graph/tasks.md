## 1. 准备工作

- [x] 1.1 在 `pyproject.toml` 添加 `pydantic-graph` 依赖
- [x] 1.2 运行 `uv sync` 更新锁文件
- [x] 1.3 创建 `crystalith/agents/base.py` 存放共享类型和工具函数（跳过：直接在各 graph 文件中定义，无需单独 base.py）
- [x] 1.4 验证 pydantic-graph 导入正常工作

## 2. 迁移 output_graph.py

- [x] 2.1 定义 `OutputGraphState` dataclass 替代 `OutputState` TypedDict
- [x] 2.2 实现 `ResolveContext` 节点类（对应 `_resolve_context`）
- [x] 2.3 实现 `GenerateOutput` 节点类（对应 `_generate_output`）
- [x] 2.4 实现 `MapCitations` 节点类（对应 `_map_output_citations`）
- [x] 2.5 实现 `PersistOutput` 节点类（对应 `_persist_output`）
- [x] 2.6 创建 `OUTPUT_GRAPH = Graph(nodes=[...])` 实例
- [x] 2.7 更新 `run_output_graph()` 函数签名和实现
- [x] 2.8 更新 `backend/py/tests/test_outputs_api.py` 适配新 API
- [x] 2.9 验证所有 output 相关测试通过

## 3. 迁移 search_graph.py

- [x] 3.1 定义 `SearchGraphState` dataclass 替代 `SearchState` TypedDict
- [x] 3.2 实现 `GenerateSummary` 节点类（对应 `_generate_summary`）
- [x] 3.3 实现 `BuildResults` 节点类（对应 `_build_results`）
- [x] 3.4 创建 `SEARCH_GRAPH = Graph(nodes=[...])` 实例
- [x] 3.5 更新 `run_search_graph()` 函数签名和实现
- [x] 3.6 更新 `backend/py/tests/test_sources_search_api.py` 适配新 API
- [x] 3.7 验证所有 search 相关测试通过

## 4. 迁移 suggestions_graph.py

- [x] 4.1 定义 `SuggestionGraphState` dataclass 替代 `SuggestionState` TypedDict
- [x] 4.2 实现 `LoadContext` 节点类（对应 `_load_context`）
- [x] 4.3 实现 `GenerateDrafts` 节点类（对应 `_generate_drafts`）
- [x] 4.4 实现 `ClassifyOrFinalize` 节点类（对应 `_classify_or_finalize`）
- [x] 4.5 创建 `SUGGESTION_GRAPH = Graph(nodes=[...])` 实例
- [x] 4.6 更新 `run_suggestions_graph()` 函数签名和实现
- [x] 4.7 更新 `backend/py/tests/test_suggestions_api.py` 适配新 API
- [x] 4.8 验证所有 suggestions 相关测试通过

## 5. 清理与验证

- [x] 5.1 从 `pyproject.toml` 移除 `langgraph` 依赖
- [x] 5.2 运行 `uv sync` 更新锁文件，确认 langgraph 相关包已移除
- [x] 5.3 搜索代码库确认无 `langgraph` 残留 import
- [x] 5.4 运行完整测试套件 `just test`（16 个相关测试全部通过）
- [x] 5.5 手动测试 Studio 输出、搜索、建议问题功能

## 6. 文档与优化（可选）

- [ ] 6.1 为每个 Graph 添加 Mermaid 图生成能力
- [ ] 6.2 更新 AGENTS.md 或相关文档说明新架构
- [ ] 6.3 考虑添加图执行日志/追踪支持
