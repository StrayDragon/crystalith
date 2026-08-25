# language: zh-CN
# capability: chat-prompt-presets
# purpose: 定义 Chat 输入中的 `/prompt:*` 指令与后端 preset registry（built-in + custom）的稳定行为：如何解析指令、如何选择生成策略，以及各 preset 的最小输出契约（包含纯文本回答与可选的 session `sharedState.ui` 更新）。
# scope: src/, tests/

功能: chat-prompt-presets

  @req:r25 @human
  场景: Prompt directives are parsed from QA question when enabled
    - 当 `app.features.chat_prompt_presets_enabled=true` 时，系统 MUST 支持在 `question` 内解析 prompt 指令： `/prompt:<preset> <query>` 其中： - `<preset>` MUST 匹配正则：`[a-z0-9_-]{1,32}`（大小写不敏感，解析后统一为小写） - `<query>` MAY 为空（空时视为输入错误）。指令解析 MUST NOT 仅接受 body 的 preset 字段。

  @req:r83 @human
  场景: Unknown preset names are rejected with a stable list
    - 系统 MUST 将 preset 集合视为白名单（built-in + custom）。未知 preset MUST 被拒绝并返回可用 preset 列表。

  @req:r121 @human
  场景: Custom prompt presets can override the QA system prompt
    - 系统 MUST 支持用户定义的 custom preset。对于 `/prompt:<preset> <query>`： - 若 `<preset>` 命中 custom preset 且 `enabled=true`，系统 MUST 使用该 preset 的 `systemPrompt` 覆盖 QA pipeline 的 system message。 - 系统 MUST 将 `<query>` 作为实际 QA question 执行（不包含 `/prompt:` 前缀）。

  @req:r157 @human
  场景: Disabled presets are rejected deterministically
    - 当 preset 存在但 `enabled=false` 时，系统 MUST 拒绝该请求并返回确定性错误。

  @req:r248 @human
  场景: Stats persists plain answer text and shared UI state
    - 当 `stats` preset 生成合法的结构化结果时，系统 MUST： - 将 `fallback_markdown` 持久化为 assistant `content` - 不依赖 `chat_ui_envelope_enabled` 或在 `content` 中嵌入 envelope。session `sharedState.ui` 的 chart/table mounts 为可选后续能力，未实现时 MUST NOT 伪造。

  @req:preset-stats @human
  场景: QA MUST support stats preset with chart and table JSON
    - QA MUST 支持 stats preset（对齐既有语义）：专用系统提示 + chart/table 结构校验与专用 JSON 解析路径。模型最终输出 MUST 为单个 JSON object（不含 code fence、解释文本或多段输出），且 MUST 满足（snake_case 键，模型输出合约，非 HTTP wire）： - `fallback_markdown: string`（MUST 非空，SHOULD 含 inline citations 如 `[1]`） - `chart: { title, unit?, items:[{ label, value }] }` - `table?: { columns, rows }`；解析/校验失败 MUST 回退默认 QA 文本生成并保持对话可用。MUST NOT 缺失该 preset。

  @req:r25 @human
  场景: directive-selects-a-preset
    - 必须成立：当 `question` 以 `/prompt:stats ` 开头且 presets 功能已启用；那么 系统 SHALL 选择 `stats` preset 的生成策略而不是默认 QA 策略
    当 `question` 以 `/prompt:stats ` 开头且 presets 功能已启用
    那么 系统 SHALL 选择 `stats` preset 的生成策略而不是默认 QA 策略

  @req:r25 @human
  场景: empty-query-returns-deterministic-error
    - 必须成立：当 `question` 为 `/prompt:stats`（无 query）且 presets 功能已启用；那么 系统 SHALL 返回 400 并提示用法与可用 preset 列表
    当 `question` 为 `/prompt:stats`（无 query）且 presets 功能已启用
    那么 系统 SHALL 返回 400 并提示用法与可用 preset 列表

  @req:r25 @human
  场景: presets-disabled-returns-deterministic-error
    - 必须成立：当 `question` 以 `/prompt:` 开头但 `app.features.chat_prompt_presets_enabled=false`；那么 系统 SHALL 返回 400（不应静默当作普通 QA 处理）
    当 `question` 以 `/prompt:` 开头但 `app.features.chat_prompt_presets_enabled=false`
    那么 系统 SHALL 返回 400（不应静默当作普通 QA 处理）

  @req:r83 @human
  场景: unknown-preset-is-rejected
    - 必须成立：当 `question` 为 `/prompt:unknown do something` 且 presets 功能已启用；那么 系统 SHALL 返回 400 并包含可用 preset 名称列表（包含 built-in 与 custom）
    当 `question` 为 `/prompt:unknown do something` 且 presets 功能已启用
    那么 系统 SHALL 返回 400 并包含可用 preset 名称列表（包含 built-in 与 custom）

  @req:r121 @human
  场景: custom-preset-overrides-system-prompt
    - 必须成立：当 用户存在 custom preset `demo` 且 `enabled=true`；那么 系统 SHALL 以 `demo.systemPrompt` 作为 system message 执行 QA
    当 用户存在 custom preset `demo` 且 `enabled=true`
    那么 系统 SHALL 以 `demo.systemPrompt` 作为 system message 执行 QA

  @req:r157 @human
  场景: disabled-preset-returns-400
    - 必须成立：当 用户存在 preset `demo` 且 `enabled=false`；那么 系统 SHALL 返回 400
    当 用户存在 preset `demo` 且 `enabled=false`
    那么 系统 SHALL 返回 400

  @req:preset-stats @human
  场景: stats-preset-returns-json-only
    - 必须成立：当 系统执行 `stats` preset；那么 系统 SHALL 要求模型仅输出 JSON object（不含 code fence、解释文本或多段输出）
    当 系统执行 `stats` preset
    那么 系统 SHALL 要求模型仅输出 JSON object（不含 code fence、解释文本或多段输出）

  @req:preset-stats @human
  场景: invalid-json-falls-back-to-text-qa
    - 必须成立：当 模型输出无法被解析/校验为 stats JSON；那么 系统 SHALL 回退生成纯文本回答并正常返回 citations/evidence/confidence
    当 模型输出无法被解析/校验为 stats JSON
    那么 系统 SHALL 回退生成纯文本回答并正常返回 citations/evidence/confidence

  @req:r248 @human
  场景: stats-returns-mounts-through-shared-state
    - 必须成立：当 `stats` preset 执行完成且结构化输出校验通过；那么 assistant 消息 `content` SHALL 仅包含 `fallback_markdown`
    当 `stats` preset 执行完成且结构化输出校验通过
    那么 assistant 消息 `content` SHALL 仅包含 `fallback_markdown`

  @req:r25 @human
  场景: directive-extracts-preset-and-query
    - 必须成立：假如 question 文本为 /prompt:stats 销售数据；当 解析阶段；那么 系统 SHALL 提取 preset=stats 并以剩余文本作为 query
    假如 question 文本为 /prompt:stats 销售数据
    当 解析阶段
    那么 系统 SHALL 提取 preset=stats 并以剩余文本作为 query

  @req:preset-stats @human
  场景: client-uses-stats
    - 必须成立：假如 客户端选择 stats preset；当 生成阶段；那么 系统 SHALL 产出 chart+table 结构化 JSON
    假如 客户端选择 stats preset
    当 生成阶段
    那么 系统 SHALL 产出 chart+table 结构化 JSON
