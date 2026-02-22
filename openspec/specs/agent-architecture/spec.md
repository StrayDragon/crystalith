# Agent Architecture Specification

## Purpose

定义 Crystalith 后端 Agent 工作流的架构与实现约束：使用 `pydantic-graph` 编排 Graph（outputs/search/research），通过显式 state/deps 保持类型安全，并在节点内部使用 `pydantic_ai.Agent` 进行结构化生成。

本规范是“编排层”的总览；outputs 生成流水线细节见 `output-graph/spec.md`，插件加载与扩展字段见 `plugin-system/spec.md`。

## Related specs

- `GLOSSARY.md`
- `output-graph/spec.md`
- `plugin-system/spec.md`
- `generation-preference/spec.md`
- `generation-retrieval/spec.md`
- `output-postprocessing/spec.md`
- `search-engine/spec.md`
- `research-ui/spec.md`

## Requirements

### Requirement: Pydantic Graph Based Workflow Orchestration
系统 SHALL 使用 `pydantic-graph` 编排多步 Agent 工作流（`Graph` + `BaseNode`），并通过节点返回类型定义边（而非显式 add_edge）。

最小覆盖：
- outputs 生成工作流（节点顺序以 `output-graph/spec.md` 为准；最终返回持久化的 Output）
- 搜索工作流：GenerateSummary → BuildResults（返回 `{message, results}`）
- Deep Research：PlanSearches → ExecuteSearches → AnalyzeResults → GenerateReport（必要时 WaitForApproval），并持久化研究会话/步骤状态

### Requirement: Node-Based State Management
每个工作流 MUST 使用 dataclass 定义状态对象，并通过 `GraphRunContext` 在节点间共享/修改 `ctx.state`；依赖 MUST 通过 `ctx.deps` 注入，且 deps SHOULD 为与工作流绑定的 deps dataclass（如 `StudioDeps` / `ResearchDeps`），保持类型安全。

### Requirement: Pydantic AI Agent Integration
节点内部 MUST 使用 `pydantic_ai.Agent` 进行 LLM 调用（结构化 `output_type` + retries），并使用 `ctx.deps` 中的模型配置。

当 LLM 调用失败时，节点 MUST 走明确 fallback 路径并记录告警日志（避免传播为不透明的 500）。

### Requirement: Graph Type Safety
图定义 MUST 提供编译时类型检查，确保节点返回类型与图定义一致。
节点返回类型 MUST 是有效的后继节点；图在构建时 SHOULD 验证节点可达性。返回 `End[T](value)` 时图执行 MUST 终止，并将 `value` 作为 `graph.run()` 返回值。

### Requirement: Dependencies Declaration
依赖声明 MUST 包含 `pydantic-graph` 包（版本跟随 pydantic-ai）。
依赖树 SHALL NOT 引入 `langgraph` 及其子包（langgraph-checkpoint、langgraph-sdk、langgraph-prebuilt）。
