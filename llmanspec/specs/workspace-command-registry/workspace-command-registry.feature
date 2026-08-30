# language: zh-CN
# capability: workspace-command-registry
# purpose: 定义前端可发现的“命令/指令” registry：客户端如何获取结构化命令定义，以驱动输入自动补全与 UI 展示，并为未来扩展更多 `/*` 命令族提供稳定接口。
# scope: apps/web/src/features/workspace/

功能: workspace-command-registry

  @req:r57 @human
  场景: Commands can be listed via /v2/commands
    - 系统 MUST 提供 `GET /v2/commands` 端点以返回命令列表（JSON array），供客户端用于自动补全与提示。

  @req:r57 @executable
  场景: list-commands-returns-a-stable-array
    假如 已启动应用
    当 请求命令列表
    那么 响应状态码为200
    而且 响应列表至少包含1条记录

  @req:r115 @human
  场景: Command schema supports future extensibility
    - `/v2/commands` 返回的命令对象 MUST 支持未来扩展更多命令族而不破坏旧客户端： - `kind` MUST 为字符串枚举；客户端 MAY 忽略未知 `kind` 并保持其它命令可用 - `meta` 字段 MAY 存在且 MUST 为 JSON object

  @req:r152 @executable
  场景: builtin-prompt-preset-appears-in-commands-list
    假如 已启动应用
    当 请求命令列表
    那么 响应中存在来源为"builtin"的命令
    而且 响应中存在触发词为"/prompt:stats"的命令

  @req:r152 @human
  场景: custom-prompt-preset-appears-and-reflects-enabled-state
    - prompt preset 命令 MUST 以 `trigger="/prompt:<preset>"` 表达可插入的触发串，且命令对象 MUST 提供 `kind="prompt_preset"` 与启用状态。用户创建自定义 preset `demo` 且 `enabled=false` 后，`GET /v2/commands` SHALL 包含 `trigger="/prompt:demo"`、`source="custom"` 且 `enabled=false` 的条目。

  @req:r187 @human
  场景: Commands are ordered deterministically
    - `GET /v2/commands` 的返回顺序 MUST 确定且稳定：多次请求的排序规则 SHALL 保持一致，MUST NOT 依赖 DB insertion order。

  @req:r187 @executable
  场景: stable-ordering
    假如 已启动应用
    当 请求命令列表
    那么 响应状态码为200
    而且 响应列表按"trigger"升序排列
