# Agent Architecture Specification

## Purpose

定义 Crystalith 后端 Agent 工作流的架构和实现要求，包括使用 pydantic-graph 进行工作流编排、节点状态管理、LLM 集成和类型安全保证。

## Requirements

### Requirement: Pydantic Graph Based Workflow Orchestration
系统 SHALL 使用 `pydantic-graph` 库进行所有 Agent 工作流编排。

#### Scenario: 输出生成工作流
- **GIVEN** 用户请求生成特定类型的结构化输出
- **WHEN** 系统调用输出生成工作流
- **THEN** 工作流 MUST 通过 pydantic-graph 的 `Graph` 和 `BaseNode` API 执行
- **AND** 工作流 SHALL 包含以下节点：ResolveContext → GenerateOutput → MapCitations → PersistOutput
- **AND** 节点 MUST 通过返回类型定义边（而非显式 add_edge）
- **AND** 最终 SHALL 返回持久化的 Output 对象

#### Scenario: 搜索工作流
- **GIVEN** 用户发起搜索请求
- **WHEN** 系统调用搜索工作流
- **THEN** 工作流 MUST 通过 pydantic-graph 执行
- **AND** 工作流 SHALL 包含节点：GenerateSummary → BuildResults
- **AND** SHALL 返回包含搜索结果的字典

#### Scenario: 建议问题工作流
- **GIVEN** 用户请求智能建议问题
- **WHEN** 系统调用建议问题工作流
- **THEN** 工作流 MUST 通过 pydantic-graph 执行
- **AND** 工作流 SHALL 包含节点：LoadContext → GenerateDrafts → ClassifyOrFinalize
- **AND** SHALL 返回建议问题列表

### Requirement: Node-Based State Management
每个工作流 MUST 使用 dataclass 定义状态对象，通过 `GraphRunContext` 在节点间传递和修改状态。

#### Scenario: 状态在节点间共享
- **GIVEN** 工作流包含多个顺序执行的节点
- **WHEN** 前一个节点修改 `ctx.state` 中的字段
- **THEN** 后续节点 MUST 可以访问修改后的状态值
- **AND** 状态类型 SHALL 通过泛型参数 `BaseNode[StateT, DepsT, OutputT]` 约束

#### Scenario: 依赖注入通过 GraphRunContext
- **GIVEN** 工作流需要访问数据库会话、向量存储等依赖
- **WHEN** 节点执行时
- **THEN** 依赖 MUST 通过 `ctx.deps` 访问
- **AND** 依赖类型 SHALL 为 `StudioDeps` dataclass

### Requirement: Pydantic AI Agent Integration
节点内部 MUST 使用 `pydantic_ai.Agent` 进行 LLM 调用，保持结构化输出和重试机制。

#### Scenario: 节点调用 LLM 生成结构化输出
- **GIVEN** GenerateOutput 节点需要生成结构化内容
- **WHEN** 节点执行时
- **THEN** MUST 创建 `pydantic_ai.Agent` 实例，配置 `output_type` 为目标 schema
- **AND** SHALL 调用 `agent.run()` 获取结构化响应
- **AND** Agent MUST 使用 `ctx.deps` 中的模型配置

#### Scenario: LLM 调用失败时使用 fallback
- **GIVEN** Agent 调用抛出异常
- **WHEN** 节点捕获异常
- **THEN** MUST 返回预定义的 fallback 内容
- **AND** SHALL 记录警告日志

### Requirement: Graph Type Safety
图定义 MUST 提供编译时类型检查，确保节点返回类型与图定义一致。

#### Scenario: 节点返回类型定义边
- **GIVEN** 定义 `ResolveContext` 节点
- **WHEN** `run()` 方法返回 `GenerateOutput()` 实例
- **THEN** 类型检查器 MUST 确认 `GenerateOutput` 是有效的后继节点
- **AND** 图 SHALL 在构建时验证所有节点的可达性

#### Scenario: End 节点终止图执行
- **GIVEN** 最后一个节点完成处理
- **WHEN** 返回 `End[Output](value)`
- **THEN** 图执行 MUST 结束
- **AND** `value` SHALL 作为 `graph.run()` 的返回结果

### Requirement: Dependencies Declaration
依赖声明 MUST 包含 `pydantic-graph` 包（版本跟随 pydantic-ai）。

#### Scenario: 依赖安装
- **GIVEN** 开发者运行 `uv sync`
- **WHEN** 安装依赖
- **THEN** MUST 安装 `pydantic-graph` 包
- **AND** SHALL NOT 安装 `langgraph` 及其子包（langgraph-checkpoint、langgraph-sdk、langgraph-prebuilt）
