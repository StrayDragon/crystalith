## Why

- 当前 Chat 的主入口是 QA：它适合“问答”，但当用户希望做更结构化/可视化的任务（例如对表格来源做统计并输出条形图）时，没有一个**确定且可复用**的方式告诉后端“用哪套预设 Prompt + 输出哪种结构化结果”，导致体验依赖临时提示词与纯文本结果，难以稳定渲染与回放。
- 将“预设 Prompt”显式化（`/prompt:*`）能把“我要做什么”从自然语言里抽离出来，使后端能选择受控的生成策略与输出结构，同时保持 `/v1` API 形状不变、避免立刻引入新版本。
- 通过引入 Tambo 的组件注册/渲染模型（而非替换整套后端），我们可以用受控的 React 组件承接结构化输出（如条形图/表格），并在不支持 UI 的客户端稳定回退为可读文本。

## What Changes

- 新增 Chat 输入指令：`/prompt:<preset> <query>`（首批 `preset=stats`），由后端解析并选择对应的预设 Prompt 与输出模式；指令本身仍通过现有 `question: string` 传输（不新增 `/v1` 字段）。
- 为 `stats` 预设落地“结构化可视化输出”最小闭环：
  - 后端基于来源上下文生成**可回放**的 UI 内容：assistant `Message.content` 写入“可读回退文本 + delimiter + JSON envelope”；
  - JSON envelope 的 `parts[]` 中包含 `component`（如 `BarChartCard` / `DataTableCard`）与必要的 `text`；
  - 前端识别并渲染这些 parts；解析失败/未知组件时回退显示 `fallback_text`。
- 引入前端 Tambo 集成（展示侧）：在现有 Vite+React Workspace 内加入 `@tambo-ai/react` 与 `zod`，用其“组件注册 + props 校验”的模式来渲染对话内组件（不引入 Tambo threads/后端替换）。
- 增强表格来源的可用性：支持上传 `.csv`（`text/csv`）并以行块方式分段，以避免单个超大 chunk 影响检索/引用。

## Capabilities

### New Capabilities

- `chat-prompt-presets`: 定义 `/prompt:*` 指令语法、预设 prompt registry、以及各 preset 的输出契约（包含回退文本与可选 UI envelope）。

### Modified Capabilities

- `workspace-api-contract`: 明确 QA 接口对“指令内嵌于 question”的解析语义，以及 assistant `content` 可内嵌 UI envelope 的兼容与导出剥离规则。
- `workspace-ui-panels`: 扩展 Chat 面板：输入支持 `/prompt:*`，消息渲染支持 UI envelope + Tambo 组件回放；同时 Sources 上传支持 `.csv` 与一致的提示文案。
- `source-ingestion-upload-and-url`: 扩展“parser-driven 支持格式”集合以包含 `.csv`/`text/csv`，并保持 415/400 的确定性错误语义不变。

## Impact

- Backend:
  - QA 路径新增 `/prompt:*` 解析与 preset 分发；`stats` 预设新增一条“结构化输出生成 + envelope 持久化”链路。
  - Source ingestion 增加 CSV 解析/分块策略（与现有 parser factory 集成）。
  - 导出/转换/LLM history 等读路径需要剥离 envelope 元数据，仅使用 `fallback_text` 作为正文。
- Frontend:
  - 新增依赖：`@tambo-ai/react`、`zod`；新增/注册 `BarChartCard` / `DataTableCard` 等展示组件。
  - ChatPanel 增加 envelope 解析、parts 渲染与安全回退；为 `/prompt:*` 提供最小可发现性（例如 placeholder/提示）。
- Security/UX:
  - 结构化 JSON 解析需严格受限（大小/深度/parts 数）并确定性回退，避免 DoS 与 XSS 风险。
  - 预设 Prompt 仅允许后端内置集合，避免用户输入直接决定任意“模式/工具执行”。
