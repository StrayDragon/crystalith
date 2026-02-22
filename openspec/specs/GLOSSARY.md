# Glossary

用于减少重复描述：各 spec 中涉及到的核心术语以此处为准（除非 spec 明确覆盖）。

## Core entities

- **Notebook**：工作区的顶层容器；拥有 Sources / Sessions / Outputs 等资源。
- **Session**：对话会话（messages 的归属单元），隶属于某个 Notebook。
- **Message**：会话内的消息记录（role/content/citations 等）。
- **Source**：来源文档或链接；可处于 ingest/index 过程中的不同状态。
- **SourceStatus**：Source 的 ingest 状态值（后端 `crystalith.shared.types.SourceStatus`）：`processing|ready|failed`。
- **Chunk**：对 Source 分块后的最小检索单位；向量化与检索以 chunk 为主。
- **Output**：结构化产物（FAQ/Guide/Timeline/Slides/…），由生成链路产出并持久化。
- **Citation**：输出或消息中的引用标记，指向 source/chunk 以支持可追溯性。
- **ResearchSession**：深度研究会话；通常经历 planning/searching/analyzing/waiting_user/completed 等状态。
- **TaskStatus**：后台任务状态值（后端 `crystalith.shared.types.TaskStatus`）：`pending|running|completed|failed|cancelled`。

## Concepts

- **Workspace**：前端主工作区页面；由多个 widget/panel 组成（Sources/Chat/Studio/Research/...）。
- **Widget**：模块化画布布局中的可拖拽/缩放单元（通常由 GridStack 承载）。
- **Studio tool**：Studio 中的“输出类型入口/工具卡片”，通常映射到某个 `OutputType`。
- **OutputType**：输出类型枚举（后端 `crystalith.shared.types.OutputType`）；前后端用于协商输出形态。
- **OutputGraph**：结构化 outputs 生成图（ResolveContext/GenerateOutput/Postprocess/MapCitations/Persist 等节点），负责把 sources → Output 持久化记录。
- **Plugin**：通过 Python entry_points 发现并注册的扩展包；可扩展输出类型、渲染描述、配置 schema 等。
- **RenderDescriptor**：后端提供的通用渲染描述（layout + 字段 schema），用于前端在无专用组件时渲染结构化 output。
- **Provider / Model**：AI Provider 指调用后端（OpenAI/Ollama/…），Model 指具体模型配置（chat/embedding）。
- **Generation preference (`preference`)**：生成倾向参数（`quality|speed`）；用于选择默认调参（检索/重试/预算等）。
- **GenerationTuning**：表驱动的默认调参集合（top_k/min_score/agent_retries/multi_query/token_budget_ratio…），由 `(OutputType, preference)` 选择。
- **Retrieval context**：生成前构建的上下文（由检索/过滤/预算/去重等策略组成）。
- **trace_id**：贯穿一次生成链路的关联 ID，用于日志与性能定位。
- **Extractor**：网页正文提取器（trafilatura/jina/firecrawl/browserless）；用于 `from-url(fetch)` 场景的内容获取与降级。
- **AnalysisResult**：Notebook 跨文档分析结果（topics/relations/contradictions）；由 `GET /v1/notebooks/{id}/analysis` 返回。
- **Topic**：一组语义相近的 chunks（chunk_ids），并带有 keywords 与可展示的 name。
- **Relation**：chunk ↔ chunk 的关系（similar/contradicts/…），带 score；UI 可聚合为 source-level 边以降低噪声。
- **Knowledge graph view**：全屏知识图谱视图；以 Sources/Outputs/Sessions 节点展示关联，并提供筛选与详情预览。
- **sources_epoch**：sources 相关缓存的版本号（例如 sources 列表与 chunks 列表）；sources/tag 变更后 bump 以实现 O(1) 失效。
- **vector_epoch**：向量检索缓存的版本号；向量集合变更（ingest/re-embed/delete）后 bump 以使旧检索缓存自然失效。
