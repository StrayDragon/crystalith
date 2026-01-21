## Why
当前后端 `crystalith/agents/` 使用 LangChain 生态的 `langgraph.graph.StateGraph` 进行工作流编排，同时混用 `pydantic_ai.Agent` 进行 LLM 调用。这种混合架构带来以下问题：

1. **依赖复杂性**：需同时维护 langgraph（及其子包 langgraph-checkpoint、langgraph-sdk、langgraph-prebuilt）和 pydantic-ai 两套生态，增加维护成本
2. **类型安全不一致**：LangGraph 的 `TypedDict` 状态管理与 Pydantic AI 的 dataclass/BaseModel 依赖注入模式不统一
3. **API 风格割裂**：LangGraph 的节点函数签名与 Pydantic AI Agent 的 RunContext 模式不一致
4. **未来演进受限**：pydantic-graph 提供了与 pydantic-ai 深度集成的原生图编排能力，包括类型安全的节点定义、依赖注入、状态管理和 Mermaid 图可视化

## What Changes
- **BREAKING** 移除 `langgraph` 依赖，替换为 `pydantic-graph`
- 重构 `crystalith/agents/` 下所有 `*_graph.py` 文件：
  - `output_graph.py`：OutputState → BaseNode 节点类
  - `search_graph.py`：SearchState → BaseNode 节点类
  - `suggestions_graph.py`：SuggestionState → BaseNode 节点类
- 统一使用 `pydantic-graph` 的 `Graph`、`BaseNode`、`GraphRunContext`、`End` API
- 保留现有 `StudioDeps` 依赖注入模式，适配 pydantic-graph 的 deps 机制
- 更新 `pyproject.toml` 依赖声明
- 更新测试以适配新的 Graph API

## Impact
- 受影响的规范：修改 `workspace-api`（如存在）、新增 `agent-architecture`
- 受影响的代码：
  - `backend/py/src/crystalith/agents/output_graph.py`
  - `backend/py/src/crystalith/agents/search_graph.py`
  - `backend/py/src/crystalith/agents/suggestions_graph.py`
  - `backend/py/src/crystalith/agents/deps.py`（适配调整）
  - `backend/py/src/crystalith/agents/models.py`（保持不变）
  - `backend/py/pyproject.toml`
  - `backend/py/tests/test_outputs_api.py`
  - `backend/py/tests/test_suggestions_api.py`
  - `backend/py/tests/test_sources_search_api.py`
