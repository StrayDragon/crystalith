# language: zh-CN
# capability: workspace-command-registry
# purpose: 定义前端可发现的“命令/指令” registry：客户端如何获取结构化命令定义，以驱动输入自动补全与 UI 展示，并为未来扩展更多 `/*` 命令族提供稳定接口。
# scope: src/, tests/

功能: workspace-command-registry

  @req:r57 @human
  场景: Commands can be listed via /v2/commands
    - 系统 MUST 提供 `GET /v2/commands` 端点以返回命令列表，供客户端用于自动补全与提示。

  @req:r115 @human
  场景: Command schema supports future extensibility
    - `/v2/commands` 返回的命令对象 MUST 支持未来扩展更多命令族而不破坏旧客户端： - `kind` MUST 为字符串枚举；客户端 MAY 忽略未知 `kind` - `meta` 字段 MAY 存在且 MUST 为 JSON object

  @req:r152 @human
  场景: Prompt preset commands are represented as triggers
    - 当命令属于 prompt preset 时，系统 MUST 以 `trigger="/prompt:<preset>"` 表达可插入的触发串，并提供描述与启用状态。

  @req:r187 @human
  场景: Commands are ordered deterministically
    - `GET /v2/commands` 的返回顺序 MUST 稳定（例如按 `trigger` 升序）。

  @req:r57 @human
  场景: list-commands-returns-a-stable-array
    - 必须成立：当 客户端请求 `GET /v2/commands`；那么 系统 SHALL 返回 JSON array
    当 客户端请求 `GET /v2/commands`
    那么 系统 SHALL 返回 JSON array

  @req:r115 @human
  场景: unknown-kind-is-ignorable
    - 必须成立：当 `GET /v2/commands` 返回包含客户端未知的 `kind`；那么 客户端 SHALL 能忽略该项并保持其它命令可用
    当 `GET /v2/commands` 返回包含客户端未知的 `kind`
    那么 客户端 SHALL 能忽略该项并保持其它命令可用

  @req:r152 @human
  场景: builtin-prompt-preset-appears-in-commands-list
    - 必须成立：当 系统存在内置 preset `stats`；那么 `GET /v2/commands` SHALL 至少包含一项 `kind="prompt_preset"` 且 `trigger="/prompt:stats"` 且 `source="builtin"` 且 `enabled=true`
    当 系统存在内置 preset `stats`
    那么 `GET /v2/commands` SHALL 至少包含一项 `kind="prompt_preset"` 且 `trigger="/prompt:stats"` 且 `source="builtin"` 且 `enabled=true`

  @req:r152 @human
  场景: custom-prompt-preset-appears-and-reflects-enabled-state
    - 必须成立：当 用户创建了自定义 preset `demo` 且 `enabled=false`；那么 `GET /v2/commands` SHALL 包含 `trigger="/prompt:demo"` 且 `source="custom"` 且 `enabled=false`
    当 用户创建了自定义 preset `demo` 且 `enabled=false`
    那么 `GET /v2/commands` SHALL 包含 `trigger="/prompt:demo"` 且 `source="custom"` 且 `enabled=false`

  @req:r187 @human
  场景: stable-ordering
    - 必须成立：当 客户端多次请求 `GET /v2/commands`；那么 返回结果的排序规则 SHALL 保持一致（不依赖 DB insertion order）
    当 客户端多次请求 `GET /v2/commands`
    那么 返回结果的排序规则 SHALL 保持一致（不依赖 DB insertion order）
