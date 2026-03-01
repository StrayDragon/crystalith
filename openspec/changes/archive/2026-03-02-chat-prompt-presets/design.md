## Context

- 现状：
  - Workspace Chat 主要通过 QA 端点生成 assistant 文本，并以 SSE `chunk/done/error` 提供流式体验。
  - 消息持久化字段以 `role/content/citations` 为主；前端 ChatPanel 直接展示 `content` 字符串。
  - Sources 上传核心支持 `.txt/.md/.markdown/.pdf`；parser 以扩展名/MIME 匹配，文本解析按“段落空行”切分 chunk。
- 痛点：
  - 用户无法用一个“确定且可复用”的方式请求**特定任务模式**（例如：对表格做统计并输出条形图），导致提示词不稳定、输出不结构化、前端无法稳定渲染与回放。
  - 表格类来源（CSV）在现有段落切分策略下易形成超大单 chunk，影响检索、引用与模型可用性。
- 约束：
  - 优先保持 `/v1` payload 形状不变（不新增 QA request 字段）。
  - 结构化内容必须可回放（刷新后仍可渲染），且在不支持 UI 的客户端可稳定回退为可读文本。
  - 前端仅把结构当“数据”渲染：禁止脚本执行；解析必须资源有界。

## Goals / Non-Goals

**Goals:**

- 支持 Chat 输入 `/prompt:<preset> <query>` 指令，后端以受控 preset registry 选择生成策略。
- 首批实现 `preset=stats`：基于来源上下文生成“可读摘要 + 条形图（可选表格）”并持久化为 UI envelope。
- 前端可渲染 UI envelope 中的组件块，并在解析失败/未知组件时确定性回退到 `fallback_text`。
- 支持 `.csv` 上传与行块切分，避免超大单 chunk。
- 引入 `@tambo-ai/react` 的“组件注册 + props 校验”模型用于展示侧渲染（不引入 Tambo threads/后端替换）。

**Non-Goals:**

- 不引入 Tambo 的 thread 管理、远程项目、或任何 Tambo 服务端依赖；不要求 `VITE_TAMBO_API_KEY`。
- 不支持用户自定义 preset（仅内置白名单 preset）。
- 不实现通用的 SSE JSON patch / UI streaming 协议；仍复用现有 `chunk/done/error`。
- 不实现复杂统计引擎；stats 聚合由模型在受控输出格式下完成。

## Decisions

1. **指令语法：仅支持 `/prompt:<preset> <query>`（大小写不敏感）**
   - 解析规则：
     - 仅当 `question.lstrip()` 以 `/prompt:` 或 `/PROMPT:` 开头时触发指令解析。
     - `<preset>`：`[a-z0-9_-]{1,32}`（转换为小写）。
     - `<query>`：指令后剩余文本 `strip()`；允许为空。
   - 行为：
     - `<query>` 为空：返回 400，提示使用方式并列出可用 presets（不会回退到普通 QA）。
     - `<preset>` 不存在：返回 400，列出可用 presets。

2. **Preset registry：后端内置、白名单化**
   - Registry 以常量/配置的方式存在于后端代码中（不从用户输入动态加载）。
   - v1 presets：
     - `stats`：生成 `fallback_markdown + chart + table?` 的结构化 JSON，并由后端包裹为 UI envelope。
   - 开关：
     - `app.features.chat_prompt_presets_enabled: bool = false`（默认关闭，避免影响现有部署；开启后才允许 `/prompt:*`）。

3. **Stats 输出格式：模型仅返回单个 JSON object，由后端验证与包裹**
   - 模型输出要求：不得包含额外文本/代码块；只输出 JSON（UTF-8）。
   - JSON 形状（逻辑模型，后端以 Pydantic 校验）：
     - `fallback_markdown: string`（必须非空；包含 inline citations，如 `[1]`）
     - `chart: { title: string, unit?: string, items: [{ label: string, value: number }] }`
     - `table?: { columns: string[], rows: (string|number|null)[][] }`
   - 解析策略：
     - 尝试直接 `json.loads(text)`；
     - 若失败，尝试从首个 `{` 到末个 `}` 抽取子串再解析；
     - 仍失败则视为生成失败：回退到普通 QA 文本生成（不输出组件）。

4. **UI envelope 持久化：复用现有“content 内嵌 delimiter + JSON”模式**
   - assistant `Message.content` 最终写入：
     - `<fallback_text> + "\\n\\n[[crystalith-ui:v1]]\\n" + <envelope_json>`
   - `fallback_text` 取自 stats JSON 的 `fallback_markdown`（必须非空）。
   - `envelope_json` 固定包含：
     - `schema: "crystalith.ui.message.v1"`
     - `parts`: 由后端按 registry 映射生成的 `text/component` parts（v1 stats 至少 1 个 `component`）。
   - 开关：
     - `app.features.chat_ui_envelope_enabled: bool = false`（默认关闭）。
     - 当 `chat_ui_envelope_enabled=false` 时：仍执行 stats preset，但只返回/持久化 `fallback_text`（不追加 delimiter 与 JSON）。

5. **前端渲染：用 Tambo “组件注册 + Zod 校验”承接 `component` parts**
   - 引入依赖：`@tambo-ai/react`、`zod`。
   - 在 Workspace 根部加入 `TamboProvider`（仅提供 `components` registry，不配置 apiKey，不使用 threads）。
   - ChatPanel 渲染策略：
     - 若消息 `content` 含 delimiter：解析并渲染 `parts[]`；
     - `component` part：按 registry 渲染（props 先经 Zod 校验，失败则 JsonFallback）。
     - 解析失败/超限：稳定回退显示 `fallback_text`（delimiter 前文本）。

6. **CSV 摄取：新增 `CSVParser`，按行块切分并输出 Markdown 表格片段**
   - TextParser 增加 `.csv`/`text/csv` 的“可识别”支持，但实际解析由 `CSVParser` 承担（优先按 mime/扩展名匹配 CSVParser）。
   - CSVParser 策略：
     - UTF-8 解码（失败则报确定性输入错误）。
     - 首行视为 header；以固定 `max_rows_per_chunk=50` 分块。
     - 每块输出为 Markdown table（带 header），并在 metadata 标注 `csv_row_start/csv_row_end`（1-based, 不含 header 行）。

7. **流式兼容：不新增 SSE 事件类型**
   - `/qa/stream` 仍仅发送 `chunk/done/error`：
     - `chunk`：仅发送 `fallback_text` 的流式文本片段（stats preset 也遵循）。
     - `done`：包含 citations/evidence/confidence/context 等现有字段；完成后由后端持久化最终 `Message.content`（可包含 envelope）。

## Risks / Trade-offs

- [风险] JSON 输出不稳定导致解析失败 → 缓解：严格输出指令 + 双阶段解析（直接 parse + 子串抽取）+ 失败回退到普通 QA 文本。
- [风险] UI envelope 元数据污染导出/转换/LLM history → 缓解：集中实现 `strip_ui_envelope(content)->fallback_text` 并在所有读路径使用。
- [风险] CSV 转 Markdown table 可能导致宽表渲染/提示成本高 → 缓解：固定行块大小、对超长单元格截断、必要时在 table 组件中折叠显示。
- [风险] 新依赖引入导致 bundle 增大 → 缓解：仅使用 Tambo 的 registry/渲染侧能力；不引入 threads 与其整套 UI 组件库。

## Migration Plan

1. 增加后端 feature flags（默认关闭），并实现 `/prompt:*` 解析与 `stats` preset（先仅返回 fallback_text）。
2. 增加 UI envelope 生成与剥离工具；开启 `chat_ui_envelope_enabled` 后 stats 可持久化组件。
3. 前端引入 TamboProvider + components registry，实现 `BarChartCard`/`DataTableCard` 并完成 envelope 渲染。
4. 增加 CSVParser 与前端上传 accept 集；补齐后端/前端测试与手工验收路径。
