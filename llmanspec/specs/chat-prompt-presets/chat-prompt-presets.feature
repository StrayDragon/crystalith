# language: zh-CN
# capability: chat-prompt-presets
# purpose: 定义 Chat 输入中的 `/prompt:*` 指令与后端 preset registry（built-in + custom）的稳定行为：如何解析指令、如何选择生成策略，以及各 preset 的最小输出契约（包含纯文本回答与可选的 session `sharedState.ui` 更新）。

功能: chat-prompt-presets

  @req:r22
  规则: Prompt directives are parsed from QA question when enabled
    系统 MUST 支持在 `question` 内解析 prompt 指令： `/prompt:<preset> <query>` 其中： - `<preset>` MUST 匹配正则：`[a-z0-9_-]{1,32}`（大小写不敏感，解析后统一为小写） - `<query>` MAY 为空（空时视为输入错误）。指令解析 MUST NOT 仅接受 body 的 preset 字段。

    场景: prompt-directive-parsed-from-question
      假如 chat_prompt_presets_enabled=true 且 question 为 "/prompt:STATS 销售数据"
      当 运行 apps/server/tests/qa/presets.test.ts 的 parsePromptDirective 用例
      那么 解析出 preset=stats（统一小写）且 question 为去前缀后的查询文本
      而且 无指令时才回退 body 的 preset 字段
  @req:r422

  规则: empty-query-returns-deterministic-error
    当 presets 功能启用且 `question` 为 `/prompt:<preset>`（无 query）时，系统 SHALL 返回 400 并提示用法与可用 preset 列表。
  
    场景: bare-directive-returns-usage-and-list
      假如 qa-preset 集成环境就绪（tests/qa/preset-resolution.test.ts）
      当 以 "/prompt:stats"（无 query）调用 QA
      那么 400 且 details 携带用法说明、触发的 presetId 与可用预设列表
@req:r423

  规则: prompt-directive-behavior-is-config-independent-and-deterministic
    `/prompt:` 指令语言不依赖可选特性开关：其解析与错误语义 MUST 在任何部署配置下保持一致（无 enabled/disabled 分支），MUST NOT 把指令静默当作普通 QA 文本处理（裸指令与未知预设见 r422/r23 的确定性 400）。

    场景: directive-deterministic-without-feature-flag
      假如 默认配置（不存在 presets 特性开关字段，tests/qa/preset-resolution.test.ts）
      当 以 "/prompt:stats 问题" 调用 QA
      那么 指令生效且回传 generation.presetId=stats
  @req:r23
  规则: Unknown preset names are rejected with a stable list
    系统 MUST 将 preset 集合视为白名单（built-in + custom）。未知 preset MUST 被拒绝并返回可用 preset 列表（含 built-in 与 custom）。

    场景: unknown-preset-rejected-with-stable-list
      假如 preset 白名单含 built-in 与 custom（tests/qa/preset-resolution.test.ts）
      当 以 "/prompt:不存在的预设 某个问题" 调用 QA
      那么 响应状态码为 400
      而且 错误信息返回可用 preset 列表
  @req:r24
  规则: Custom prompt presets can override the QA system prompt
    系统 MUST 支持用户定义的 custom preset。对于 `/prompt:<preset> <query>`： - 若 `<preset>` 命中 custom preset 且 `enabled=true`，系统 MUST 使用该 preset 的 `systemPrompt` 覆盖 QA pipeline 的 system message。 - 系统 MUST 将 `<query>` 作为实际 QA question 执行（不包含 `/prompt:` 前缀）。
  
    场景: custom-preset-overrides-qa-system-prompt
      假如 qa-preset 集成环境就绪且存在 enabled=true 的 custom preset（tests/qa/preset-resolution.test.ts）
      当 以 "/prompt:<trigger> <query>" 调用 QA
      那么 该 preset 的 systemPrompt 覆盖 QA 系统消息（{{directive}} 占位与内置同法渲染）
      而且 <query> 作为实际 question 执行且 generation.presetId 回传 trigger
@req:r25
  规则: Disabled presets are rejected deterministically
    当 preset 存在但 `enabled=false` 时，系统 MUST 拒绝该请求并返回确定性错误。

    场景: disabled-preset-rejected-deterministically
      假如 存在 enabled=false 的 preset（如 disabled-test，tests/qa/preset-resolution.test.ts）
      当 以 "/prompt:disabled-test 某个问题" 调用 QA
      那么 响应状态码为 400
      而且 重复调用返回相同的确定性错误
  @req:r26
  规则: Stats persists plain answer text and shared UI state
    当 `stats` preset 生成合法的结构化结果时，系统 MUST 将 `fallback_markdown` 持久化为 assistant `content`，且不依赖 `chat_ui_envelope_enabled`、不在 `content` 中嵌入 envelope（见 chat-ui-envelope r28/r29）；session `sharedState.ui` 的 chart/table mounts 为可选后续能力，未实现时 MUST NOT 伪造。

    场景: stats-fallback-markdown-persisted
      假如 stats preset 的模型输出为合法的 chart/table JSON
      当 运行 apps/server/tests/qa/presets-wire.test.ts 的 r26 用例（POST /v2/notebooks/:nid/qa）
      那么 响应 answer 即 fallback_markdown 的纯文本
      而且 assistant message 持久化的 content 与 answer 一致且不嵌 envelope
  @req:r27
  规则: QA MUST support stats preset with chart and table JSON
    QA MUST 支持 stats preset（对齐既有语义）：专用系统提示 + chart/table 结构校验与专用 JSON 解析路径。模型最终输出 MUST 为单个 JSON object（不含 code fence、解释文本或多段输出），且 MUST 满足（snake_case 键，模型输出合约，非 HTTP wire）： - `fallback_markdown: string`（MUST 非空，SHOULD 含 inline citations 如 `[1]`） - `chart: { title, unit?, items:[{ label, value }] }` - `table?: { columns, rows }`；解析/校验失败 MUST 回退默认 QA 文本生成并保持对话可用。MUST NOT 缺失该 preset。

    场景: stats-preset-parses-chart-table-json
      假如 stats preset 使用专用系统提示且模型输出含 fallback_markdown/chart/table 的 JSON
      当 运行 apps/server/tests/qa/presets.test.ts 的 parseStatsPresetOutput 用例与 bdd stats 提问场景
      那么 合法 JSON（snake_case 键）经专用解析路径产出 chart/table 结构
      而且 环绕散文或 code fence 中的 JSON 仍可被提取校验
  @req:r424

  规则: invalid-json-falls-back-to-text-qa
    当模型输出无法被解析/校验为 stats JSON 时，系统 SHALL 回退默认 QA 文本生成并保持对话可用，正常返回 citations/evidence/confidence。

    场景: invalid-stats-json-falls-back-to-text
      假如 stats preset 的模型输出无法解析/校验为 stats JSON
      当 运行 apps/server/tests/qa/presets-wire.test.ts 的 r424 用例
      那么 回退文本生成的原文作为 answer 正常返回
      而且 citations/evidence/confidence 字段照常返回且对话可用
