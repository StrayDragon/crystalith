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

### Requirement: Output Generation Pipeline

The system MUST generate structured outputs via `OutputGraph` (ResolveContext → GenerateOutput → MapCitations → PersistOutput). The `GenerateOutput` node MUST select schema and default_prompt with the following priority:

1. If `PluginRegistry.output_types` contains a matching `OutputTypePlugin` for the given `output_type`, the system MUST use the plugin-provided `schema` and `default_prompt`.
2. Otherwise, the system MUST fall back to the core `OUTPUT_SCHEMAS` and `DEFAULT_PROMPTS`.

#### Scenario: Plugin overrides output type schema
- **WHEN** an `OutputTypePlugin` registers `output_type = "QUIZ"` with a custom `schema` and `default_prompt`
- **THEN** `GenerateOutput` MUST use the plugin's schema and prompt instead of the core fallback
- **AND** the generated output content conforms to the plugin schema structure

#### Scenario: Fallback when no plugin is installed
- **WHEN** no `OutputTypePlugin` registers `output_type = "QUIZ"`
- **THEN** `GenerateOutput` MUST use `OUTPUT_SCHEMAS[OutputType.QUIZ]` and `DEFAULT_PROMPTS[OutputType.QUIZ]`

#### Scenario: Plugin provides metadata
- **WHEN** an `OutputTypePlugin` provides `metadata` (containing `description`, `display_text`, `tone`)
- **THEN** `PluginRegistry` MUST record the metadata
- **AND** the metadata SHALL be accessible via `registry.get_output_type_metadata()`

### Requirement: OutputTypePlugin Optional Extension Attributes

The `OutputTypePlugin` Protocol MUST remain unchanged (only `output_type`, `schema`, `default_prompt`). The system MUST support optional extension attributes detected via `getattr()` at registration time:

- `metadata: OutputTypePluginMeta | None` — display metadata (description, display_text, tone)
- `render_descriptor: RenderDescriptor | None` — frontend rendering layout description
- `config_schema: PluginConfigSchema | None` — generation dialog configuration

The `PluginRegistry` MUST store these extension attributes in separate dictionaries, keyed by `output_type`.

#### Scenario: Plugin provides all extension attributes
- **WHEN** a plugin provides `metadata`, `render_descriptor`, and `config_schema`
- **THEN** the registry MUST store all three attributes
- **AND** they SHALL be retrievable via `get_output_type_metadata()`, `get_render_descriptor()`, `get_config_schema()`

#### Scenario: Plugin provides no extension attributes
- **WHEN** a plugin does not define `metadata`, `render_descriptor`, or `config_schema`
- **THEN** the plugin MUST still register normally via the base Protocol
- **AND** `getattr()` calls for missing attributes MUST return `None`
- **AND** the system SHALL use core defaults where applicable

#### Scenario: Plugin provides invalid extension attribute types
- **WHEN** a plugin defines `metadata` but it is not an `OutputTypePluginMeta` instance
- **THEN** the compliance checker MUST report a warning
- **AND** the registry MUST ignore the invalid attribute and treat it as absent

### Requirement: Output Type Plugin Conflict Handling

When multiple plugins register the same `output_type`, the system MUST handle the conflict gracefully.

#### Scenario: Two plugins register the same output_type
- **WHEN** plugin A registers `output_type = "QUIZ"` and plugin B also registers `output_type = "QUIZ"`
- **THEN** the registry MUST overwrite plugin A with plugin B (last-wins)
- **AND** the registry MUST log a warning message indicating the conflict

### Requirement: OutputTypePlugin Render Descriptor Support

The `OutputTypePlugin` MAY provide an optional `render_descriptor` attribute of type `RenderDescriptor`. The render descriptor describes how the frontend SHALL render the plugin's output content using generic layout components.

The `RenderDescriptor` MUST contain:
- `layout: str` — one of `list`, `cards`, `tree`, `timeline`, `sections`, `table`
- `item_schema: ItemSchema | None` — describes the fields of each item
- `options: dict` — layout-specific options

When a plugin provides a `render_descriptor`, the backend MUST include it in API responses so the frontend can render the output without a dedicated component.

#### Scenario: Plugin provides render_descriptor
- **WHEN** a plugin sets `render_descriptor` with `layout="cards"` and field descriptors
- **THEN** the registry MUST store the render_descriptor
- **AND** the API MUST include it in the workspace tools response

#### Scenario: Plugin without render_descriptor
- **WHEN** a plugin does not set `render_descriptor` (or sets it to `None`)
- **THEN** the plugin MUST still register normally
- **AND** the frontend SHALL fall back to raw JSON rendering

### Requirement: OutputTypePlugin Config Schema Support

The system MUST support an optional `config_schema` attribute on `OutputTypePlugin` of type `PluginConfigSchema`. The config schema describes the generation dialog options (quantity, difficulty, topic support, etc.) for the frontend.

The `PluginConfigSchema` MUST contain:
- `quantity_options: list[ConfigOption]` — quantity presets
- `difficulty_options: list[ConfigOption]` — difficulty presets
- `topic_placeholder: str` — placeholder text for topic input
- `supports_topic: bool` — whether the output type supports topic customization

#### Scenario: Plugin provides config_schema
- **WHEN** a plugin sets `config_schema` with quantity and difficulty options
- **THEN** the registry MUST store the config_schema
- **AND** the API MUST include it in the workspace tools response

#### Scenario: Plugin without config_schema
- **WHEN** a plugin does not set `config_schema`
- **THEN** the frontend SHALL use default generation dialog options

### Requirement: Output Type Plugin Package Structure

Each output type plugin package MUST:
1. Be an independent Python package registered via `entry_points` under `crystalith.plugins`
2. Implement the `OutputTypePlugin` protocol, providing `output_type`, `schema`, and `default_prompt`
3. The plugin's `schema` MUST be a `pydantic.BaseModel` subclass
4. The plugin's `output_type` MUST match one of the core `OutputType` enum values
5. The plugin MUST NOT import from `crystalith.shared.agents.output_schemas` (schema independence)

#### Scenario: QUIZ output type plugin
- **WHEN** `crystalith-output-quiz` plugin is installed and enabled
- **THEN** the plugin MUST register `output_type = "QUIZ"`
- **AND** provide a self-contained `QuizOutput` schema and a corresponding default_prompt

#### Scenario: TIMELINE output type plugin
- **WHEN** `crystalith-output-timeline` plugin is installed and enabled
- **THEN** the plugin MUST register `output_type = "TIMELINE"`
- **AND** provide a self-contained `TimelineOutput` schema and a corresponding default_prompt

#### Scenario: MINDMAP output type plugin
- **WHEN** `crystalith-output-mindmap` plugin is installed and enabled
- **THEN** the plugin MUST register `output_type = "MINDMAP"`
- **AND** provide a self-contained `MindmapOutput` schema and a corresponding default_prompt

### Requirement: Render Types Module

The system MUST provide a `shared/plugins/render_types.py` module containing the Pydantic models for extension attributes:
- `OutputTypePluginMeta`
- `RenderDescriptor`, `ItemSchema`, `FieldDescriptor`
- `PluginConfigSchema`, `ConfigOption`

These models MUST be importable by plugin packages without requiring the full core application as a dependency.

#### Scenario: Plugin imports render_types
- **WHEN** a plugin package imports `RenderDescriptor` from `crystalith.shared.plugins.render_types`
- **THEN** the import MUST succeed without requiring other core modules

### Requirement: Dependencies Declaration
依赖声明 MUST 包含 `pydantic-graph` 包（版本跟随 pydantic-ai）。

#### Scenario: 依赖安装
- **GIVEN** 开发者运行 `uv sync`
- **WHEN** 安装依赖
- **THEN** MUST 安装 `pydantic-graph` 包
- **AND** SHALL NOT 安装 `langgraph` 及其子包（langgraph-checkpoint、langgraph-sdk、langgraph-prebuilt）

### Requirement: OutputType-based Default Tuning
系统 MUST 能基于 `OutputType + GenerationPreference` 选择默认 tuning，并在调用方未显式提供参数时应用到检索与生成阶段。

#### Scenario: 显式参数优先
- **GIVEN** 请求显式提供了 `top_k/min_score`
- **WHEN** 系统生成某个 OutputType 的输出
- **THEN** 系统 MUST 使用显式提供的 `top_k/min_score`
- **AND** MUST NOT 被默认 tuning 覆盖

#### Scenario: 未显式提供时应用默认 tuning
- **GIVEN** 请求未显式提供 `top_k/min_score`
- **WHEN** 系统生成某个 OutputType 的输出且 `preference=quality`
- **THEN** 系统 MUST 使用该 OutputType 的 quality 默认 tuning

### Requirement: Consistent Model Settings Application
系统 MUST 在所有基于 `pydantic_ai.Agent` 的生成路径中一致应用来自配置的模型请求设置（completion options + request options），并在日志中记录 effective settings。

#### Scenario: OutputGraph 应用 completion options
- **GIVEN** 配置为默认 chat 模型设置了 `completion_options.temperature` 与 `completion_options.max_tokens`
- **WHEN** 系统通过 OutputGraph 生成结构化输出
- **THEN** LLM 请求 MUST 使用该 temperature/max_tokens 作为默认生成参数
- **AND** 日志 MUST 记录本次生成的 effective completion options

#### Scenario: OutputGraph 应用 request options
- **GIVEN** 配置为默认 chat 模型设置了 `request_options.timeout` 与自定义 headers
- **WHEN** 系统通过 OutputGraph 调用 LLM
- **THEN** LLM 请求 MUST 使用该 timeout 与 headers

### Requirement: No Nested Provider Retries
系统 MUST 避免在 Agent 路径中出现“SDK 内置重试 + 业务层重试”的嵌套行为。系统 SHOULD 将网络/限流类错误的重试边界统一到业务层策略中。

#### Scenario: 禁用 SDK 内置重试
- **WHEN** 系统构建用于 Agent 的 OpenAI-compatible client
- **THEN** SDK 的内置重试 MUST 被禁用（或设置为 0）

### Requirement: Graph Nodes Respect Concurrency and Cancellation
系统 MUST 确保 Agent/Graph 节点在执行 embedding/search/model 调用时遵循并发限制，并在请求取消时尽早退出。

#### Scenario: OutputGraph 受 limiter 保护
- **WHEN** OutputGraph 执行检索与生成阶段
- **THEN** 每个阶段 MUST 在对应 limiter 下运行（或等价保护）

#### Scenario: 取消时不继续后续节点
- **WHEN** 在图执行过程中发生请求取消
- **THEN** 图 SHOULD 不再继续执行后续昂贵节点（例如生成或持久化），或以明确的取消结果终止

### Requirement: Lenient Core Output Schema Parsing
系统 MUST 对核心结构化输出的 schema 解析采取宽容策略：当模型输出存在轻微偏差（例如额外字段、citations 类型偏差、列表元素为字符串）时，系统仍应尽最大可能解析并进入后处理归一化阶段，避免不必要的 fallback。

#### Scenario: 忽略额外字段但保留核心结构
- **WHEN** 模型输出在合法 JSON 结构基础上包含额外字段
- **THEN** 系统 MUST 忽略额外字段而不触发整体 schema 校验失败

#### Scenario: citations 类型偏差可被归一化
- **WHEN** 模型输出的 citations 以字符串/混合列表等形式出现
- **THEN** 系统 MUST 将其归一化为整数索引列表并在后处理阶段进行合法性清洗

#### Scenario: CitedText 列表元素可为字符串
- **WHEN** 模型输出将 `items`/`bullets` 等字段的元素以字符串形式返回
- **THEN** 系统 MUST 将字符串视为 `text` 并补全缺失字段（例如 citations 默认空列表）
