## Context
Crystalith 后端当前使用混合架构：
- **LangGraph**（`langgraph.graph.StateGraph`）：用于定义多步骤工作流（输出生成、搜索、建议问题）
- **Pydantic AI**（`pydantic_ai.Agent`）：用于 LLM 调用，提供结构化输出和重试机制

这种混合模式源于项目早期的技术选型，当时 pydantic-graph 尚未成熟。现在 pydantic-graph 已提供完整的图编排能力，且与 pydantic-ai 深度集成，是统一技术栈的时机。

### 当前架构分析

**output_graph.py**：
```python
# 当前：LangGraph StateGraph + Pydantic AI Agent
class OutputState(TypedDict, total=False):
    notebook_id: int
    output_type: OutputType
    # ... 更多字段

def _build_graph():
    graph = StateGraph(OutputState)
    graph.add_node("resolve_context", _resolve_context)
    graph.add_node("generate_output", _generate_output)
    # ...
    return graph.compile()
```

**目标架构**：
```python
# 目标：纯 pydantic-graph
@dataclass
class OutputState:
    notebook_id: int
    output_type: OutputType
    # ... 更多字段

@dataclass
class ResolveContext(BaseNode[OutputState, StudioDeps, Output]):
    async def run(self, ctx: GraphRunContext[OutputState, StudioDeps]) -> GenerateOutput | End[Output]:
        # 解析上下文逻辑
        return GenerateOutput()

output_graph = Graph(nodes=[ResolveContext, GenerateOutput, MapCitations, PersistOutput])
```

## Goals / Non-Goals

### Goals
1. 移除 `langgraph` 依赖，减少依赖树复杂度
2. 统一使用 `pydantic-graph` 进行工作流编排
3. 保持现有功能行为不变（输出生成、搜索、建议问题）
4. 保持现有 API 契约不变（HTTP 接口兼容）
5. 利用 pydantic-graph 的类型安全优势
6. 支持 Mermaid 图可视化（调试/文档用途）

### Non-Goals
1. 不引入 pydantic-graph 的持久化检查点功能（保持内存状态）
2. 不修改 `pydantic-ai` Agent 的使用方式（仍用于 LLM 调用）
3. 不改变现有的依赖注入模式（`StudioDeps`）
4. 不修改输出 schema 定义（`output_schemas.py` 保持不变）
5. 不引入 pydantic-graph beta API（使用稳定的 `BaseNode` API）

## Decisions

### Decision 1: 使用 `BaseNode` API 而非 `GraphBuilder` beta API
**选择**：使用稳定的 `pydantic_graph.BaseNode` + `Graph` API
**原因**：
- `GraphBuilder` 仍在 beta 阶段，API 可能变化
- `BaseNode` 已在官方文档和示例中广泛使用
- `BaseNode` 的 dataclass 风格与现有 `StudioDeps` 模式一致

### Decision 2: 状态管理从 TypedDict 迁移到 dataclass
**选择**：将 `OutputState`、`SearchState`、`SuggestionState` 从 `TypedDict` 改为 `@dataclass`
**原因**：
- pydantic-graph 的 `GraphRunContext[StateT, DepsT]` 期望 State 是可变对象
- dataclass 提供更好的类型提示和默认值支持
- 与 `StudioDeps` 的 dataclass 风格一致

### Decision 3: 节点返回类型定义边
**选择**：通过节点 `run()` 方法的返回类型定义图的边
**原因**：
- pydantic-graph 的核心设计：节点返回下一个节点实例或 `End[T]`
- 提供编译时类型检查
- 消除手动 `add_edge()` 的需要

### Decision 4: 依赖注入适配
**选择**：将 `StudioDeps` 作为 `Graph.run()` 的 `deps` 参数传入
**原因**：
- pydantic-graph 原生支持依赖注入
- 保持与现有 `pydantic_ai.Agent` 的 `deps` 模式一致

### Alternatives Considered

| 方案 | 优点 | 缺点 | 决定 |
|------|------|------|------|
| 继续使用 LangGraph | 无需迁移成本 | 维护两套生态，类型不一致 | ❌ 拒绝 |
| 使用 pydantic-graph beta API (GraphBuilder) | 更简洁的装饰器风格 | API 不稳定，可能需要再次迁移 | ❌ 拒绝 |
| 完全移除图编排，使用纯函数链 | 最简单 | 失去类型安全的流程控制和可视化 | ❌ 拒绝 |
| **使用 pydantic-graph BaseNode API** | 稳定、类型安全、与 pydantic-ai 深度集成 | 需要迁移工作 | ✅ 采用 |

## Architecture Mapping

### output_graph.py 迁移映射

| LangGraph 概念 | pydantic-graph 对应 |
|----------------|---------------------|
| `StateGraph(OutputState)` | `Graph(nodes=[...])` |
| `graph.add_node("name", func)` | `class NodeName(BaseNode[State, Deps, Output])` |
| `graph.add_edge("a", "b")` | `NodeA.run() -> NodeB` 返回类型 |
| `graph.set_entry_point("name")` | `Graph.run(NodeName(), state=...)` |
| `END` | `End[Output]` |
| 节点函数 `async def func(state: StateDict)` | `async def run(self, ctx: GraphRunContext[State, Deps])` |

### 节点类设计

```python
# output_graph.py 新设计

@dataclass
class OutputGraphState:
    notebook_id: int
    output_type: OutputType
    prompt: str
    chunk_ids: list[int] | None = None
    top_k: int = 10
    min_score: float = 0.0
    context: str = ""
    citations: list[Citation] = field(default_factory=list)
    resolved_chunk_ids: list[int] = field(default_factory=list)
    content: dict[str, Any] = field(default_factory=dict)
    db_output: Output | None = None

@dataclass
class ResolveContext(BaseNode[OutputGraphState, StudioDeps, Output]):
    async def run(self, ctx: GraphRunContext[OutputGraphState, StudioDeps]) -> GenerateOutput:
        # 实现 _resolve_context 逻辑
        # 更新 ctx.state.context, ctx.state.citations, ctx.state.resolved_chunk_ids
        return GenerateOutput()

@dataclass
class GenerateOutput(BaseNode[OutputGraphState, StudioDeps, Output]):
    async def run(self, ctx: GraphRunContext[OutputGraphState, StudioDeps]) -> MapCitations:
        # 实现 _generate_output 逻辑，调用 pydantic_ai.Agent
        return MapCitations()

@dataclass
class MapCitations(BaseNode[OutputGraphState, StudioDeps, Output]):
    async def run(self, ctx: GraphRunContext[OutputGraphState, StudioDeps]) -> PersistOutput:
        # 实现 _map_output_citations 逻辑
        return PersistOutput()

@dataclass
class PersistOutput(BaseNode[OutputGraphState, StudioDeps, Output]):
    async def run(self, ctx: GraphRunContext[OutputGraphState, StudioDeps]) -> End[Output]:
        # 实现 _persist_output 逻辑
        return End(ctx.state.db_output)

OUTPUT_GRAPH = Graph(nodes=[ResolveContext, GenerateOutput, MapCitations, PersistOutput])

async def run_output_graph(
    state: OutputGraphState,
    deps: StudioDeps,
) -> Output:
    result = await OUTPUT_GRAPH.run(ResolveContext(), state=state, deps=deps)
    return result.output
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| pydantic-graph API 在未来版本中变化 | 需要再次迁移 | 使用稳定的 BaseNode API，锁定版本 |
| 迁移引入回归 Bug | 功能异常 | 保持测试覆盖，逐步迁移每个 graph |
| 团队学习成本 | 开发效率暂时下降 | 提供迁移指南和代码示例 |
| pydantic-graph 功能不如 LangGraph 完整 | 某些高级场景受限 | 当前使用场景简单，不需要高级功能 |

## Migration Plan

### Phase 1: 准备工作
1. 添加 `pydantic-graph` 依赖到 `pyproject.toml`
2. 创建 `crystalith/agents/nodes.py` 存放共享的节点基类和工具函数
3. 保留 `langgraph` 依赖，实现并行迁移

### Phase 2: 逐个 Graph 迁移
1. **output_graph.py**（最复杂，优先迁移）
   - 创建 `OutputGraphState` dataclass
   - 实现 4 个节点类
   - 更新 `run_output_graph()` 签名
   - 更新相关测试
2. **search_graph.py**（中等复杂度）
   - 创建 `SearchGraphState` dataclass
   - 实现 2 个节点类
   - 更新相关测试
3. **suggestions_graph.py**（最简单）
   - 创建 `SuggestionGraphState` dataclass
   - 实现 3 个节点类
   - 更新相关测试

### Phase 3: 清理
1. 移除 `langgraph` 依赖
2. 更新 `uv.lock`
3. 验证所有测试通过
4. 添加 Mermaid 图生成工具函数（可选）

## Open Questions

1. **是否需要为每个 Graph 生成 Mermaid 文档？**
   - 建议：作为 bonus feature，在开发文档中添加

2. **是否需要保留 TypedDict 作为 API 层的类型定义？**
   - 建议：不需要，API 层使用 Pydantic BaseModel（已是如此）

3. **pydantic-graph 的最低版本要求？**
   - 建议：跟随 pydantic-ai 版本，当前项目使用 `pydantic-ai>=0.0.49`

4. **是否需要支持图执行的中间状态检查？**
   - 建议：暂不需要，当前只需最终结果
