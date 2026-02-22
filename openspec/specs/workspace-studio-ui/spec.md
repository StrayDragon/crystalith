# workspace-studio-ui Specification

## Purpose

定义 Workspace 中 **Studio 模块**的最小交互契约：工具目录展示与配置、输出生成的队列/取消/重试、输出查看与导出，以及与“已选来源范围”的联动。本规范不重复各输出类型内容结构；各类型细节见对应的 Studio 输出类型 specs（本文件 Related specs 已列出）。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`（tools catalog、outputs/slides 端点）
- `output-rendering/spec.md`（通用渲染：render_descriptor → GenericOutputRenderer）
- `generation-preference/spec.md`
- `refine-output/spec.md`
- `content-conversion/spec.md`（对话/输出转换为来源）
- `source-ingestion/spec.md`（转换后 source 的生命周期/状态）
- `workspace-ux-system/spec.md`（layer/z-index、toast、modal 等）
- `studio-slides/spec.md`
- `studio-briefing/spec.md`
- `studio-guide/spec.md`
- `studio-flashcard/spec.md`
- `studio-mindmap/spec.md`
- `studio-quiz/spec.md`
- `studio-timeline/spec.md`

## Requirements

### Requirement: Studio module composition
Studio 模块 MUST 提供输出列表（历史 + 队列任务）、“添加笔记”入口、以及“生成/选择工具”入口（面板内或弹出层均可）。

在窄宽度下输出列表仍 MUST 可滚动查看，且生成入口与添加笔记入口保持可达。

### Requirement: Output generation is gated by selected sources
Studio 的生成入口 MUST 与“已选来源范围”联动：当选中来源集合为空时，工具卡片/生成按钮 MUST disabled，并给出明确提示（如 tooltip/notice “请先选择来源”）。

### Requirement: Tool catalog rendering and config dialog
前端 MUST 使用 Workspace tools catalog 渲染工具列表，并支持打开工具参数配置：

- 非 `SLIDES`：使用通用配置对话框（quantity/difficulty/topic/model 等）
- `SLIDES`：进入 Slides 配置/预览流程（见 `studio-slides/spec.md`）

用户在工具配置中选择的约束 MUST 反映到发往后端的 prompt（至少作为附加约束段落）。

### Requirement: Generation preference propagation
Studio MUST 提供“生成倾向（preference）”选择，并在生成与重试时保持一致：

- 非 `SLIDES`：outputs 创建请求体包含 `preference`
- `SLIDES`：持久化到 draft 的 `generation_config.preference`

### Requirement: Output queue statuses and cancellation
Studio MUST 以队列形式展示生成任务，并支持取消进行中的任务；队列状态 MUST 至少覆盖 `queued`/`running`/`done`/`error`/`cancelled`。

取消 `running` 任务时客户端 MUST 中断对应请求/流，状态更新为 `cancelled`，且 outputs 列表 MUST NOT 出现“半成品”持久化记录；`error` 状态 MUST 提供 retry 并可重新入队。

### Requirement: Output rendering priority and fallback
Studio 输出查看器 MUST 按 `output-rendering/spec.md` 的优先级渲染：

1. 专用插件（若存在）
2. 通用渲染（若存在 `render_descriptor`）
3. 原始 JSON 回退

当前端无专用插件且无 `render_descriptor` 时，UI MUST 以原始 JSON 形式渲染（确保可调试与可用）。

### Requirement: Output export formats
输出查看器 MUST 提供导出功能，并只展示该输出类型支持的格式（支持列表见前端 exporter 定义）：

- 所有输出类型至少支持 `Markdown`
- `SLIDES` 支持 `PPTX`
- `BRIEFING` 支持 `PDF`
- `FAQ` / `QUIZ` 支持 `JSON`
