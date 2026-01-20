## Context
后端当前使用自定义 ChatProvider 直接生成 JSON 输出，缺乏 LangGraph 编排与 Pydantic AI 的类型安全输出。Studio 功能需要可组合的 Agent 和更稳定的结构化数据生成与依赖注入。

## Goals / Non-Goals
- Goals:
  - 用 LangGraph 组织 Studio 输出、建议问题、搜索流程。
  - 使用 Pydantic AI Agent + BaseModel 输出，提升结构化输出可靠性。
  - 保持异步调用和可扩展的依赖注入。
- Non-Goals:
  - 引入持久化的 LangGraph checkpoint（仅内存）。
  - 一次性替换所有现有非 Studio 端点的 LLM 逻辑。

## Decisions
- Decision: 引入 `crystalith/agents/` 作为后端 Agent 层，不直接复用前端命名。
- Decision: 使用 `OpenAIChatModel` + Provider 方式接入 OpenAI/Ollama，复用现有 Settings。
- Decision: Studio 相关 API 允许结构调整，以便更贴合 v1 Studio 需求。

## Risks / Trade-offs
- 结构化输出的模型约束可能导致重试开销上升 → 通过 `retries` 控制重试次数。
- 现有测试依赖 ChatProvider Mock → 需要替换为 Pydantic AI TestModel/FunctionModel。

## Migration Plan
1. 添加依赖与基础 Agent/Graph 架构。
2. 重构 Studio 输出与列表接口。
3. 迁移 Suggestions 与 Search 逻辑。
4. 补齐测试。

## Open Questions
- 是否需要为 Studio 输出补充独立的“详情”接口字段扩展？
