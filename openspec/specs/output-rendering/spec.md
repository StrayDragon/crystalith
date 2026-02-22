# output-rendering Specification

## Purpose

定义前端对“结构化输出内容”的通用渲染契约：当某个 output type 没有专用前端插件时，系统可基于后端提供的 `render_descriptor` 进行通用布局渲染；并保证缺失/不兼容时可回退为原始 JSON 渲染。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`（工具目录返回 render_descriptor/config_schema）
- `plugin-system/spec.md`（PluginRegistry 对 output type 的扩展属性）

## Requirements

### Requirement: GenericOutputRenderer component
前端 MUST 提供 `GenericOutputRenderer` 组件，用于按 `RenderDescriptor` 渲染 output `content`。

`RenderDescriptor.layout` MUST 支持：
- `list` — 列表
- `cards` — 卡片网格
- `tree` — 树结构
- `timeline` — 时间轴
- `sections` — 分节
- `table` — 表格

字段渲染 MUST 遵循 `FieldDescriptor` 定义，支持字段类型：
`text`, `heading`, `badge`, `list`, `tree`, `date`, `citation`, `code`。
`render_descriptor.layout` 未识别时 `GenericOutputRenderer` MUST 回退为原始 JSON 渲染，并输出 warning；`FieldDescriptor.children` 非空时 MUST 递归渲染且 MUST 限制最大递归深度以避免无限递归。

### Requirement: RenderDescriptor API contract (workspace tools)
后端在 `GET /v1/workspace/tools` 返回的工具条目中 MAY 包含 `render_descriptor` 与 `config_schema`。

`render_descriptor` MUST 符合：
- `layout: "list"|"cards"|"tree"|"timeline"|"sections"|"table"`
- `item_schema: { fields: FieldDescriptor[] } | null`
- `options: object`

`FieldDescriptor` MUST 包含：
- `key: string`
- `type: "text"|"heading"|"badge"|"list"|"tree"|"date"|"citation"|"code"`
- `label: string | null`
- `children: FieldDescriptor[]`（可选嵌套）

`config_schema` MUST 符合：
- `quantity_options: ConfigOption[]`
- `difficulty_options: ConfigOption[]`
- `topic_placeholder: string`
- `supports_topic: boolean`
工具条目未包含 `render_descriptor`（或为 `null`）时，前端 MUST 将其视为 `null` 且不影响专用渲染路径。

### Requirement: Rendering priority
前端 MUST 按以下优先级渲染 output：

1. 若 `pluginRegistry` 注册了该 output type 的专用插件 → 使用专用插件渲染
2. 否则若存在 `render_descriptor` → 使用 `GenericOutputRenderer`
3. 否则 → 渲染原始 JSON
output type 有专用插件但未提供 `render_descriptor` 时，前端 MUST 仍使用专用插件渲染（不依赖 `render_descriptor`）。

### Requirement: RenderDescriptor data flow (frontend caching)
前端 MUST 缓存来自 `GET /v1/workspace/tools` 的 `render_descriptor`（按 outputType 建立 lookup），并使 `OutputContent` 可在无专用插件时查找使用。
`OutputContent` 处理未注册专用插件的 output type 时 MUST 从缓存 map 读取 `render_descriptor`，存在则传给 `GenericOutputRenderer`。
