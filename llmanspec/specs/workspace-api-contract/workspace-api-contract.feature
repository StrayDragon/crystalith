# language: zh-CN
# capability: workspace-api-contract
# purpose: 定义前后端协作所依赖的稳定 API 契约：版本前缀、错误信封、核心端点稳定字段与 SSE 事件最小形状。
# scope: apps/, packages/

功能: workspace-api-contract

  @req:r56 @human
  场景: API major version prefix is stable
    - 对外业务 API MUST 使用 `/v2` 前缀；同一 major 内保持兼容。健康检查等运维端点 MAY 位于根路径。

  @req:r114 @human
  场景: Optional API key authentication is supported for self-host
    - 当 `app.auth.enabled` 且配置鉴权密钥时，`/v2/**` 端点 MUST 要求 Bearer token；未启用时 MAY 匿名访问。

  @req:r151 @human
  场景: Non-SSE errors use unified envelope
    - 非 SSE 错误响应 MUST 使用统一错误信封：`errorCode`, `message`, `details?`, `retryAfter?`。所有非 SSE 错误 MUST 经共享错误 helper（或等价入口）返回，HTTP status→errorCode 映射 MUST 来自集中映射表；MUST NOT 返回 {error: string} 等 ad-hoc 形状。

  @req:r186 @human
  场景: Rate limited responses use unified envelope and retryAfter
    - 系统 MUST 为 HTTP rate limiting 提供稳定的对外语义：返回 429，并在统一错误信封中暴露 `retryAfter` 指引。

  @req:r218 @human
  场景: Health endpoints remain exempt from HTTP guardrails
    - 系统的健康检查端点 MUST 保持可用于运维探活与诊断，不应因 guardrails 被拒绝。

  @req:r244 @human
  场景: Notebook/session/message endpoints are stable
    - notebook、session、message 的范围归属与 404/400 语义 MUST 稳定。

  @req:r262 @human
  场景: Assistant message content remains plain text while UI is transported out-of-band
    - 系统 MUST 将 assistant 消息 `content: string` 保持为纯文本/markdown 回答；结构化 UI MUST 通过 session-scoped `sharedState.ui` 提供，而不是嵌入 `content`。

  @req:r273 @human
  场景: Session UI state endpoints are stable and server-authoritative
    - 系统 MUST 提供 session-scoped UI 状态端点： - `GET /v2/notebooks/{notebookId}/sessions/{sessionId}/ui/state` - `POST /v2/notebooks/{notebookId}/sessions/{sessionId}/ui/event` `GET` MUST 返回 `sessionId`、`sharedState`、`sharedStateRevision`；`POST` MUST 接收 `CUSTOM(name="ui.v1.event")`，并返回 `delta` 与最新 `sharedStateRevision`。

  @req:r63 @human
  场景: Prompt presets CRUD endpoints are stable
    - 系统 MUST 提供 prompt presets 的 CRUD 端点集合： - `GET /v2/prompt-presets`：返回 built-in + custom 的 preset 列表 - `POST /v2/prompt-presets`：创建 custom preset 并返回 201 - `PATCH /v2/prompt-presets/{presetId}`：更新 custom preset 并返回更新后的对象 - `DELETE /v2/prompt-presets/{presetId}`：删除 custom preset 并返回 204

  @req:r69 @human
  场景: QA endpoints accept in-band prompt directives in question
    - QA 端点 MUST 支持在 `question: string` 中内嵌 `/prompt:<preset> <query>` 指令，并在启用 presets 功能时以该指令选择受控的预设生成策略；指令解析语义的 canonical 约束见 chat-prompt-presets r25。

  @req:r73 @human
  场景: QA endpoints provide stable stream and non-stream contracts
    - `/qa` 与 `/qa/stream` MUST 保持稳定字段语义，stream 至少包含 `chunk|done|error` 事件。

  @req:r75 @human
  场景: Citation model remains camelCase within the global camelCase wire
    - citation 对象 MUST 继续使用 camelCase（sourceId/sourceName/chunkId/chunkIndex/pageNumber/paragraphIndex/snippet/score），并与全局 wire camelCase 规则一致；MUST NOT 回退 snake_case。

  @req:r78 @human
  场景: Exports can include citations
    - 系统 MUST 支持将 QA/Outputs 导出为包含 citations 的格式（Markdown/JSON 或等价），以便分享与复盘。

  @req:r79 @human
  场景: Workspace tools and outputs endpoints are stable
    - `/v2/workspace/tools` 与 outputs/slides 相关端点 MUST 保持可用与向后兼容；其中 `/v2/workspace/tools` 的"可用工具集合"允许随已安装/已启用插件变化而变化，但响应形状与字段语义 MUST 稳定。

  @req:r17 @human
  场景: Workspace tools list returns available tools only
    - `/v2/workspace/tools` 返回的 tools 列表 MUST 仅包含"当前可用"的工具项（可用 = core 内置能力 + 已安装且已启用、并通过兼容性门禁的插件能力）。对于 `SLIDES`，其可用性 MUST 由当前 active `SlidesWorkflowPlugin` 决定，而不是由 core 默认内置。

  @req:r18 @human
  场景: Tools endpoint exposes diagnostics in a machine-readable form
    - `/v2/workspace/tools` 响应 MUST 暴露 `diagnostics` 字段，用于解释插件能力为什么可用/不可用，并为 UI 与自托管排障提供可执行提示。 `diagnostics` MUST 至少包含： - `diagnostics.plugins.loaded: string[]`：本次启动加载成功的插件 id 列表 - `diagnostics.plugins.skipped: { [pluginId: string]: { errorCode: string, message: string, hint?: string, details?: object } }`：加载被跳过的插件与稳定 skip detail 为覆盖“官方插件未安装（无 entry point，因此不会出现在 skipped）”的场景，`diagnostics` MUST 额外包含一个轻量的 official catalog（仅字符串/提示，不引入重依赖），用于给出明确的安装/启用指引。 official catalog MUST 覆盖当前版本所定义的**全部官方插件**，包括开箱即用的内置能力与需要显式安装/启用的扩展；当不存在需额外安装的官方扩展时，catalog 允许为空集合。

  @req:r19 @human
  场景: Workspace tools can expose frontendBundle descriptor
    - `/v2/workspace/tools` 返回的 tool 对象 MUST 支持可选字段 `frontendBundle`，用于声明该输出类型的前端渲染 bundle。

  @req:r20 @human
  场景: Workspace tools expose a complete configSchema
    - `/v2/workspace/tools` 返回的工具对象 MUST 包含可直接驱动 UI 的 `configSchema`（如支持主题、数量/难度选项与默认值）。对于 `SLIDES`，该 `configSchema` MUST 覆盖 defaults、quantity / audience / structure / tone / language / density / theme / frontmatter，以及 active plugin 声明的 engine / preview 相关元数据；客户端 MUST NOT 依赖独立 slides config 端点。

  @req:r21 @human
  场景: Tool config endpoint stays consistent (if present)
    - 若 `/v2/workspace/tools/{toolId}/config` 端点存在，其返回值 MUST 与 tools 列表中的 `configSchema` 语义一致。

  @req:models-list-must-return-providers-envelope @human
  场景: Models list MUST return providers field on the list envelope (not only separate endpoint)
    - models 列表端点 MUST 在响应 envelope 返回 providers 字段；MAY 另提供 /models/providers。

  @req:models-must-filter-by-provider-availability @human
  场景: Models endpoints MUST filter by provider availability
    - models GET list 与 GET single MUST 按 provider 可用性过滤：不可用 provider 的 model 不出现在 list；GET single SHALL 404。

  @req:sessions-convert-must-honor-message-ids @human
  场景: Sessions convert-to-source and convert-to-output MUST honor messageIds filter
    - sessions 的 convert-to-source 与 convert-to-output MUST 接受可选 messageIds：仅转换指定消息；缺失 id 时 404。省略 messageIds 时 MAY 转换会话全部消息。

  @req:sessions-convert-text-format-uses-stable-role-labels @human
  场景: Sessions convert text format MUST match v1 role labels and separators
    - sessions convert-to-source MUST 使用中文角色标签与稳定分隔；convert-to-output MUST 使用 raw 文本（无角色前缀）。

  @req:models-response-defaults-on-envelope @human
  场景: Models response MUST put defaults on envelope (not inline per-model) for list endpoint
    - models 列表端点 MUST 在 envelope 顶层提供 `defaults`；列表项 MAY 额外携带 isDefaultChat/isDefaultEmbedding。GET single MUST NOT 要求默认标记字段。

  @req:qa-export-endpoint @human
  场景: API MUST provide QA export endpoint with stable export shape
    - 系统 MUST 提供 QA 导出端点支持 markdown 与 json 两种格式：markdown 输出 SHALL 含 question/answer/citations 三段结构与 Notebook ID 行，citation 行 SHALL 包含 pageNumber/paragraphIndex；JSON 输出 SHALL 顶层含 notebookId，sources meta SHALL 为 sourceId/sourceName/mimeType/parserType 且 notebook-scoped。

  @req:qa-response-shape @human
  场景: QA responses MUST include evidence and confidence and done-event fields
    - QA 非流式响应 MUST 在 body 中包含 confidence 和 evidence 字段；流式 done 事件 payload MUST 包含 evidence/context/createdAt/confidence/citations/messageId 字段。

  @req:domain-errors-use-envelope-and-status @human
  场景: Domain conflicts use AppHttpError envelope
    - 业务状态机非法与乐观锁冲突 MUST 通过 AppHttpError 返回统一 ErrorEnvelope：乐观锁冲突 MUST 使用 409 CONFLICT；非法状态转换 MUST 使用 400 INVALID_REQUEST 或 409 CONFLICT；MUST NOT 用裸 Error 落入非结构化 500，也 MUST NOT 用 NotFoundError 伪装冲突。

  @req:list-endpoints-use-paginated-envelope @human
  场景: List endpoints MUST use PaginatedSchema envelope
    - notebook-scoped 或可增长的列表端点（至少包括 messages、sessions、sources、outputs、studio slides）MUST 接受 PaginationParams（offset/limit）并 MUST 返回 PaginatedSchema 形状：items、total、offset、limit。MUST NOT 再对上述端点返回无 total 的裸数组作为成功响应。

  @req:openapi-docs-match-handler-paths @human
  场景: OpenAPI and AsyncAPI paths MUST match handlers
    - registerApiDoc 与 AsyncAPI 中登记的 path MUST 与 Elysia handler 实际 path 一致。列表端点的 OpenAPI response 描述 MUST 反映 PaginatedSchema 而非裸数组。

  @req:process-registries-remain-global-flat @human
  场景: Process registry endpoints MUST remain global flat
    - 进程级 registry 端点 MUST 保持全局扁平且 MUST NOT 嵌套到 /v2/notebooks/:nid/...：至少包括 GET /v2/sources/parsers。另：notebooks 列表、models、commands、prompt-presets、templates MUST 保持扁平。

  @req:nested-path-nid-is-ownership-ssot @human
  场景: Nested path :nid is ownership SSOT
    - 嵌套 canonical 路由上，path :nid MUST 为归属唯一真源；请求 body MUST NOT 再要求必填 notebookId。若 body 携带 notebookId：等于 :nid 时 MUST 忽略；不等于时 MUST 返回 400。响应实体 MAY/SHOULD 继续包含 notebookId 字段。笔记本作用域资源 MUST NOT 再提供扁平 query/body notebookId 平行面。notebook 作用域资源（至少包括 outputs CRUD、qa（含 stream/export）、studio/slides、sources 单资源与 upload）的 canonical HTTP path MUST 为 /v2/notebooks/:nid/<domain>/...，跨 notebook 访问 MUST 返回 404。非嵌套的归属校验端点 MUST 要求显式归属参数（query 或 path）；资源存在但不属于该 notebook 时 MUST 返回 404 且 MUST NOT 按全局 id 返回数据。

  @req:param-format-validation-envelope @human
  场景: Path id format failures use the unified validation envelope
    - path 中的资源 id 参数格式非法（无法解析为正整数）时，系统 MUST 返回统一 ErrorEnvelope（422 SCHEMA_VALIDATION_FAILED），与 body 校验失败的验证语义一致；query 中可选 id 的宽松解析语义 MAY 保持。资源不存在或不属于该 notebook 时 MUST 保持 404 NOT_FOUND（归属语义见 nested-path-nid-is-ownership-ssot）。

  @req:qa-stream-remains-post-with-body @human
  场景: QA stream MUST remain POST with body
    - 交互式 QA SSE（含 notebook 嵌套路径）MUST 使用 POST，并在 body 中携带问题与上下文（sourceIds/策略等）。MUST NOT 要求客户端把大 payload 塞进 query string。

  @req:progress-streams-use-get @human
  场景: Existing-resource progress streams MUST use GET
    - 对已存在资源的进度/订阅类 SSE（至少 studio slides outline/content stream）MUST 使用 GET .../stream。AsyncAPI/OpenAPI 登记的 method 与 path MUST 与实现一致。

  @req:output-list-omits-full-content @human
  场景: Output list MUST omit full content
    - outputs（Studio 笔记）列表端点成功响应中的每个 item MUST NOT 包含完整 generation payload / 长 markdown 正文。item MUST 至少含标识与展示所需元数据（如 id、type、title、status、timestamps）；可选短 preview。完整正文 MUST 仅由单条详情端点返回。

  @req:output-detail-returns-full-content @human
  场景: Output detail MUST return full content
    - GET 单条 output（notebook-scoped）MUST 返回渲染所需的完整内容字段。客户端在用户选中/打开条目前 MUST NOT 依赖 list 内嵌全文。

  @req:r284 @human
  场景: CitationSchema SSOT is camelCase in packages/shared
    - packages/shared 的 CitationSchema MUST 以 camelCase 字段作为 Zod SSOT，并驱动 OpenAPI/eden 类型；服务端序列化与前端消费 MUST 直接使用该 schema 推断类型，不得并行维护一套 snake_case Citation 线类型。

  @req:r285 @human
  场景: HTTP JSON wire fields MUST be camelCase end-to-end
    - 除 URL path 与 SSE event 名称外，对外 HTTP/SSE JSON（请求体、查询参数键、响应体、流式 done/error data）的字段名 MUST 为 camelCase，并以 packages/shared Zod 为 SSOT；MUST NOT 再使用 notebook_id/source_ids/created_at/error_code 等 snake_case wire 别名。DB 列名不受本要求约束。

  @req:notebook-scoped-list-forbid-global @human
  场景: Notebook-scoped lists MUST NOT dump all notebooks
    - 笔记本范围列表端点在缺少 notebook 过滤时 MUST 拒绝请求（400）；MUST NOT 返回全部 notebook 的聚合列表。

  @req:r56 @human
  场景: client-targets-stable-major-prefix
    - 必须成立：当 客户端调用对外 API；那么 端点 SHALL 使用 `/v2` 前缀且在同一 major 内保持兼容
    当 客户端调用对外 API
    那么 端点 SHALL 使用 `/v2` 前缀且在同一 major 内保持兼容

  @req:r114 @human
  场景: auth-enabled-requires-bearer-token-for-v2-deferred
    - 必须成立：当 运维启用鉴权并配置了 API key；那么 客户端请求任意 `/v2/**` 端点若未携带有效 token SHALL 返回 401
    当 运维启用鉴权并配置了 API key
    那么 客户端请求任意 `/v2/**` 端点若未携带有效 token SHALL 返回 401

  @req:r114 @human
  场景: health-endpoints-remain-accessible-without-auth
    - 必须成立：当 运维启用鉴权并配置了 API key；那么 `/health` 与 `/health/dependencies` SHALL 保持匿名可访问以支持探活与运维诊断
    当 运维启用鉴权并配置了 API key
    那么 `/health` 与 `/health/dependencies` SHALL 保持匿名可访问以支持探活与运维诊断

  @req:r151 @human
  场景: non-sse-error-envelope-is-consistent
    - 必须成立：当 非 SSE 请求发生错误；那么 系统 SHALL 返回统一错误结构并包含 `errorCode` 与 `message`
    当 非 SSE 请求发生错误
    那么 系统 SHALL 返回统一错误结构并包含 `errorCode` 与 `message`

  @req:r151 @human
  场景: non-sse-error-shape
    - 必须成立：假如 一个 feature router 命中可预期错误（sourceId 越权或 schema 校验失败）；当 系统返回错误响应；那么 body MUST 匹配 ErrorEnvelopeSchema（含 errorCode 与 message）且 MUST NOT 是 {error: string} 或其它 ad-hoc 形状
    假如 一个 feature router 命中可预期错误（sourceId 越权或 schema 校验失败）
    当 系统返回错误响应
    那么 body MUST 匹配 ErrorEnvelopeSchema（含 errorCode 与 message）且 MUST NOT 是 {error: string} 或其它 ad-hoc 形状

  @req:r151 @human
  场景: single-helper-source
    - 必须成立：假如 开发者新增 feature router 错误分支；当 通过共享 helper 返回错误；那么 输出与其它 router 一致且 errorCode 来自集中映射表而非自定义字符串
    假如 开发者新增 feature router 错误分支
    当 通过共享 helper 返回错误
    那么 输出与其它 router 一致且 errorCode 来自集中映射表而非自定义字符串

  @req:r186 @human
  场景: client-receives-429-with-retry-guidance
    - 必须成立：当 客户端触发 rate limit；那么 系统 SHALL 返回 429
    当 客户端触发 rate limit
    那么 系统 SHALL 返回 429

  @req:r218 @human
  场景: health-stays-accessible-while-guardrails-are-enabled
    - 必须成立：当 运维启用 guardrails（非本地暴露或显式 enabled）；那么 `/health` 与 `/health/dependencies` SHALL 仍可匿名访问
    当 运维启用 guardrails（非本地暴露或显式 enabled）
    那么 `/health` 与 `/health/dependencies` SHALL 仍可匿名访问

  @req:r244 @human
  场景: stable-error-semantics-for-ownership-and-validation
    - 必须成立：当 请求引用了不存在或不属于当前 notebook 的 session/message；那么 系统 SHALL 以稳定的 404/400 语义响应
    当 请求引用了不存在或不属于当前 notebook 的 session/message
    那么 系统 SHALL 以稳定的 404/400 语义响应

  @req:r262 @human
  场景: list-messages-returns-plain-assistant-content
    - 必须成立：当 客户端调用 messages 列表端点获取某条 assistant 消息；那么 响应中的 `content` SHALL 仅包含回答文本
    当 客户端调用 messages 列表端点获取某条 assistant 消息
    那么 响应中的 `content` SHALL 仅包含回答文本

  @req:r273 @human
  场景: ui-state-snapshot-restores-a-session
    - 必须成立：当 客户端请求 `/ui/state`；那么 系统 SHALL 返回该 session 当前的完整 `sharedState` snapshot 与 revision
    当 客户端请求 `/ui/state`
    那么 系统 SHALL 返回该 session 当前的完整 `sharedState` snapshot 与 revision

  @req:r273 @human
  场景: ui-event-endpoint-is-revision-aware-and-idempotent
    - 必须成立：当 客户端向 `/ui/event` 发送带 `clientRequestId` 与 `baseRevision` 的 `ui.v1.event`；那么 系统 SHALL 做幂等处理与 revision 冲突检查
    当 客户端向 `/ui/event` 发送带 `clientRequestId` 与 `baseRevision` 的 `ui.v1.event`
    那么 系统 SHALL 做幂等处理与 revision 冲突检查

  @req:r63 @human
  场景: list-includes-built-in-and-custom
    - 必须成立：当 客户端请求 `GET /v2/prompt-presets`；那么 返回列表 SHALL 同时包含 `source="builtin"` 与 `source="custom"` 项（如存在）
    当 客户端请求 `GET /v2/prompt-presets`
    那么 返回列表 SHALL 同时包含 `source="builtin"` 与 `source="custom"` 项（如存在）

  @req:r63 @human
  场景: creating-a-preset-returns-409-on-conflicts
    - 必须成立：当 客户端创建一个 trigger 与 built-in 或已存在 custom 冲突的 preset；那么 系统 SHALL 返回 409
    当 客户端创建一个 trigger 与 built-in 或已存在 custom 冲突的 preset
    那么 系统 SHALL 返回 409

  @req:r63 @human
  场景: updating-deleting-missing-preset-returns-404
    - 必须成立：当 客户端更新或删除一个不存在的 `presetId`；那么 系统 SHALL 返回 404
    当 客户端更新或删除一个不存在的 `presetId`
    那么 系统 SHALL 返回 404

  @req:r69 @human
  场景: qa-non-stream-respects-prompt-directive
    - 必须成立：当 客户端调用 `/v2/notebooks/{notebookId}/qa` 且 `question` 以 `/prompt:` 开头；那么 系统 SHALL 在不改变 `/v2` payload 字段形状的前提下解析指令并选择对应 preset
    当 客户端调用 `/v2/notebooks/{notebookId}/qa` 且 `question` 以 `/prompt:` 开头
    那么 系统 SHALL 在不改变 `/v2` payload 字段形状的前提下解析指令并选择对应 preset

  @req:r69 @human
  场景: qa-stream-respects-prompt-directive
    - 必须成立：当 客户端调用 `/v2/notebooks/{notebookId}/qa/stream` 且 `question` 以 `/prompt:` 开头；那么 系统 SHALL 解析指令并在 stream 中保持 `chunk|done|error` 的最小事件集语义稳定
    当 客户端调用 `/v2/notebooks/{notebookId}/qa/stream` 且 `question` 以 `/prompt:` 开头
    那么 系统 SHALL 解析指令并在 stream 中保持 `chunk|done|error` 的最小事件集语义稳定

  @req:r73 @human
  场景: qa-stream-emits-minimal-event-set
    - 必须成立：当 客户端使用 `/qa/stream` 发起问答；那么 stream SHALL 至少包含 `chunk|done|error` 事件并保持字段语义稳定
    当 客户端使用 `/qa/stream` 发起问答
    那么 stream SHALL 至少包含 `chunk|done|error` 事件并保持字段语义稳定

  @req:r73 @human
  场景: qa-stream-carries-shared-ui-state-updates
    - 必须成立：当 客户端使用 `/qa/stream` 发起问答且该回答包含交互 UI；那么 stream SHALL 保持 `chunk|done|error` 的最小事件集稳定
    当 客户端使用 `/qa/stream` 发起问答且该回答包含交互 UI
    那么 stream SHALL 保持 `chunk|done|error` 的最小事件集稳定

  @req:r75 @human
  场景: citation-stays-camelcase
    - 必须成立：假如 系统处于 camelCase wire 契约下；当 读取 QA citations；那么 citation 字段 SHALL 仍为 sourceId/sourceName/chunkId 等 camelCase
    假如 系统处于 camelCase wire 契约下
    当 读取 QA citations
    那么 citation 字段 SHALL 仍为 sourceId/sourceName/chunkId 等 camelCase

  @req:r78 @human
  场景: export-includes-citation-list
    - 必须成立：当 用户导出 QA 或某个 Output；那么 导出结果 SHALL 包含引用清单与可定位信息（sourceId 或可解析来源标识）
    当 用户导出 QA 或某个 Output
    那么 导出结果 SHALL 包含引用清单与可定位信息（sourceId 或可解析来源标识）

  @req:r79 @human
  场景: tools-endpoint-stays-compatible-while-tool-set-is-dynamic
    - 必须成立：当 前端依赖 `/v2/workspace/tools` 获取工具列表；那么 系统 SHALL 保持端点可用且字段语义稳定
    当 前端依赖 `/v2/workspace/tools` 获取工具列表
    那么 系统 SHALL 保持端点可用且字段语义稳定

  @req:r17 @human
  场景: disabled-plugin-removes-tool-but-yields-diagnostics
    - 必须成立：当 某输出类型插件被禁用或加载失败；那么 tools 列表 SHALL 不包含该 tool
    当 某输出类型插件被禁用或加载失败
    那么 tools 列表 SHALL 不包含该 tool

  @req:r17 @human
  场景: missing-or-ambiguous-slides-plugin-removes-tool-and-yields-d
    - 必须成立：当 系统未加载任何可生效的 slides workflow plugin，或同时发现多个候选但未能唯一确定 active plugin；那么 tools 列表 SHALL 不包含 `SLIDES`
    当 系统未加载任何可生效的 slides workflow plugin，或同时发现多个候选但未能唯一确定 active plugin
    那么 tools 列表 SHALL 不包含 `SLIDES`

  @req:r18 @human
  场景: client-renders-missing-capability-hints
    - 必须成立：当 客户端收到 tools 响应；那么 客户端 SHALL 能定位到缺失/禁用/未安装的插件条目
    当 客户端收到 tools 响应
    那么 客户端 SHALL 能定位到缺失/禁用/未安装的插件条目

  @req:r19 @human
  场景: tools-response-includes-optional-frontend-bundle
    - 必须成立：当 客户端请求 `/v2/workspace/tools`；那么 每个 tool 对象 MAY 包含 `frontendBundle`
    当 客户端请求 `/v2/workspace/tools`
    那么 每个 tool 对象 MAY 包含 `frontendBundle`

  @req:r20 @human
  场景: studio-ui-renders-from-tools-list-only
    - 必须成立：当 客户端请求 `/v2/workspace/tools`；那么 返回的每个 tool SHALL 包含其 `configSchema`（若该 tool 支持配置）
    当 客户端请求 `/v2/workspace/tools`
    那么 返回的每个 tool SHALL 包含其 `configSchema`（若该 tool 支持配置）

  @req:r20 @human
  场景: slides-config-is-derived-from-tools-response-only
    - 必须成立：当 客户端请求 `/v2/workspace/tools`；那么 `SLIDES` tool（若存在） SHALL 在其 `configSchema` 中返回完整配置语义
    当 客户端请求 `/v2/workspace/tools`
    那么 `SLIDES` tool（若存在） SHALL 在其 `configSchema` 中返回完整配置语义

  @req:r21 @human
  场景: config-endpoint-matches-config-schema
    - 必须成立：当 客户端请求 `/v2/workspace/tools/{toolId}/config`；那么 返回的选项集合与默认值语义 SHALL 与对应 tool 的 `configSchema` 一致
    当 客户端请求 `/v2/workspace/tools/{toolId}/config`
    那么 返回的选项集合与默认值语义 SHALL 与对应 tool 的 `configSchema` 一致

  @req:models-list-must-return-providers-envelope @human
  场景: read-providers
    - 必须成立：假如 前端读 GET /models 响应的 providers 字段；当 系统返回 models list；那么 envelope SHALL 含 providers 字段（与既有语义一致）
    假如 前端读 GET /models 响应的 providers 字段
    当 系统返回 models list
    那么 envelope SHALL 含 providers 字段（与既有语义一致）

  @req:models-must-filter-by-provider-availability @human
  场景: unconfigured-provider-model
    - 必须成立：假如 某 model 的 provider 未配置；当 系统返回 models list / GET single；那么 该 model SHALL 不出现在 list；GET single SHALL 404
    假如 某 model 的 provider 未配置
    当 系统返回 models list / GET single
    那么 该 model SHALL 不出现在 list；GET single SHALL 404

  @req:sessions-convert-must-honor-message-ids @human
  场景: convert-subset
    - 必须成立：假如 客户端传 messageIds=[1,3] 转换；当 系统执行 convert-to-source/output；那么 SHALL 仅转换消息 1 与 3；缺失 id → 404
    假如 客户端传 messageIds=[1,3] 转换
    当 系统执行 convert-to-source/output
    那么 SHALL 仅转换消息 1 与 3；缺失 id → 404

  @req:sessions-convert-text-format-uses-stable-role-labels @human
  场景: convert-text-format
    - 必须成立：假如 用户转换 session 为 source/output；当 系统生成文本；那么 source 用中文角色标签 + \n\n；output 用 raw 文本（与既有语义一致）
    假如 用户转换 session 为 source/output
    当 系统生成文本
    那么 source 用中文角色标签 + \n\n；output 用 raw 文本（与既有语义一致）

  @req:models-response-defaults-on-envelope @human
  场景: defaults-envelope
    - 必须成立：假如 前端读 GET /models 的默认 model；当 系统返回 list；那么 `defaults.chat`/`defaults.embedding` SHALL 在 envelope 顶层（非每 model 内联）
    假如 前端读 GET /models 的默认 model
    当 系统返回 list
    那么 `defaults.chat`/`defaults.embedding` SHALL 在 envelope 顶层（非每 model 内联）

  @req:qa-export-endpoint @human
  场景: markdown-export
    - 必须成立：假如 一个 session 有 assistant 回答；当 客户端请求 GET /v2/notebooks/:nid/qa/export?sessionId=X&format=markdown；那么 系统 SHALL 返回 text/markdown 内容含 question/answer/citations 三段结构及 Content-Disposition header
    假如 一个 session 有 assistant 回答
    当 客户端请求 GET /v2/notebooks/:nid/qa/export?sessionId=X&format=markdown
    那么 系统 SHALL 返回 text/markdown 内容含 question/answer/citations 三段结构及 Content-Disposition header

  @req:qa-response-shape @human
  场景: done-event-fields
    - 必须成立：假如 QA 流式完成；当 done 事件发出；那么 事件 payload SHALL 包含 evidence 和 context 和 createdAt 和 confidence 和 citations 和 messageId
    假如 QA 流式完成
    当 done 事件发出
    那么 事件 payload SHALL 包含 evidence 和 context 和 createdAt 和 confidence 和 citations 和 messageId

  @req:qa-response-shape @human
  场景: non-streaming-response
    - 必须成立：假如 客户端发送非流式 QA 请求；当 响应返回；那么 响应 body SHALL 包含 confidence 和 evidence 字段
    假如 客户端发送非流式 QA 请求
    当 响应返回
    那么 响应 body SHALL 包含 confidence 和 evidence 字段

  @req:domain-errors-use-envelope-and-status @human
  场景: session-revision-conflict-409
    - 必须成立：假如 客户端以过期 sharedStateRevision 更新 session；当 发生乐观锁冲突；那么 系统 SHALL 返回 409 CONFLICT 与 ErrorEnvelope，且 MUST NOT 返回伪装的 404
    假如 客户端以过期 sharedStateRevision 更新 session
    当 发生乐观锁冲突
    那么 系统 SHALL 返回 409 CONFLICT 与 ErrorEnvelope，且 MUST NOT 返回伪装的 404

  @req:list-endpoints-use-paginated-envelope @human
  场景: messages-paginated
    - 必须成立：假如 notebook 下存在多条消息；当 客户端调用 messages 列表端点；那么 系统 SHALL 返回 items/total/offset/limit 信封而非裸数组
    假如 notebook 下存在多条消息
    当 客户端调用 messages 列表端点
    那么 系统 SHALL 返回 items/total/offset/limit 信封而非裸数组

  @req:openapi-docs-match-handler-paths @human
  场景: docs-match-handlers
    - 必须成立：当 检查 registerApiDoc 与 AsyncAPI 登记；那么 文档 path/method SHALL 与 Elysia handler 一致且 MUST NOT 登记已删除端点
    当 检查 registerApiDoc 与 AsyncAPI 登记
    那么 文档 path/method SHALL 与 Elysia handler 一致且 MUST NOT 登记已删除端点

  @req:nested-path-nid-is-ownership-ssot @human
  场景: nested-paths-accepted
    - 必须成立：假如 notebook N 存在；当 客户端 POST /v2/notebooks/N/outputs；那么 请求 SHALL 命中嵌套路由并以 N 为归属
    假如 notebook N 存在
    当 客户端 POST /v2/notebooks/N/outputs
    那么 请求 SHALL 命中嵌套路由并以 N 为归属

  @req:process-registries-remain-global-flat @human
  场景: registry-flat
    - 必须成立：当 客户端请求 GET /v2/sources/parsers；那么 系统 SHALL 返回全局扁平结果且路径不嵌套
    当 客户端请求 GET /v2/sources/parsers
    那么 系统 SHALL 返回全局扁平结果且路径不嵌套

  @req:nested-path-nid-is-ownership-ssot @human
  场景: flat-outputs-gone
    - 必须成立：假如 嵌套 outputs 已挂载且扁平 alias 已删除；当 客户端请求 GET /v2/outputs?notebookId=N；那么 系统 SHALL 不命中业务 handler（404 或等价未挂载）
    假如 嵌套 outputs 已挂载且扁平 alias 已删除
    当 客户端请求 GET /v2/outputs?notebookId=N
    那么 系统 SHALL 不命中业务 handler（404 或等价未挂载）

  @req:param-format-validation-envelope @human
  场景: non-numeric-path-id
    - 必须成立：假如 客户端以非数字 path id 请求 notebook-scoped 资源；当 发送请求；那么 响应 SHALL 为统一 ErrorEnvelope 且 errorCode 为 SCHEMA_VALIDATION_FAILED
    假如 客户端以非数字 path id 请求 notebook-scoped 资源
    当 发送请求
    那么 响应 SHALL 为统一 ErrorEnvelope 且 errorCode 为 SCHEMA_VALIDATION_FAILED

  @req:nested-path-nid-is-ownership-ssot @human
  场景: nested-post-without-body-notebook-id
    - 必须成立：假如 存在 notebook N；当 客户端 POST /v2/notebooks/N/outputs 且 body 省略 notebookId；那么 请求 SHALL 被接受（其余字段合法时）并以 N 为归属
    假如 存在 notebook N
    当 客户端 POST /v2/notebooks/N/outputs 且 body 省略 notebookId
    那么 请求 SHALL 被接受（其余字段合法时）并以 N 为归属

  @req:qa-stream-remains-post-with-body @human
  场景: qa-stream-post
    - 必须成立：假如 notebook 与 sources 就绪；当 客户端 POST /v2/notebooks/:nid/qa/stream（或等价 canonical）携带 body；那么 服务端 SHALL 以 SSE 流式返回且 MUST NOT 要求 GET+query 传全文
    假如 notebook 与 sources 就绪
    当 客户端 POST /v2/notebooks/:nid/qa/stream（或等价 canonical）携带 body
    那么 服务端 SHALL 以 SSE 流式返回且 MUST NOT 要求 GET+query 传全文

  @req:progress-streams-use-get @human
  场景: research-stream-get
    - 必须成立：假如 资源已创建；当 客户端 GET .../stream；那么 服务端 SHALL 以 SSE 推送进度且文档 method SHALL 为 GET
    假如 资源已创建
    当 客户端 GET .../stream
    那么 服务端 SHALL 以 SSE 推送进度且文档 method SHALL 为 GET

  @req:output-list-omits-full-content @human
  场景: list-without-body
    - 必须成立：假如 notebook 下存在含长正文的 output；当 客户端调用 list outputs；那么 响应 items SHALL 不含完整正文大字段
    假如 notebook 下存在含长正文的 output
    当 客户端调用 list outputs
    那么 响应 items SHALL 不含完整正文大字段

  @req:output-detail-returns-full-content @human
  场景: detail-has-body
    - 必须成立：假如 同一 output 存在；当 客户端 GET 该 output 详情；那么 响应 SHALL 含完整内容可供渲染
    假如 同一 output 存在
    当 客户端 GET 该 output 详情
    那么 响应 SHALL 含完整内容可供渲染

  @req:r284 @human
  场景: shared-citation-schema-camelcase
    - 必须成立：假如 CitationSchema 已更新为 camelCase；当 服务端构建 citations 或前端类型检查 Citation；那么 两端 SHALL 共用同一 camelCase 字段集且类型检查通过
    假如 CitationSchema 已更新为 camelCase
    当 服务端构建 citations 或前端类型检查 Citation
    那么 两端 SHALL 共用同一 camelCase 字段集且类型检查通过

  @req:r285 @human
  场景: qa-request-response-camelcase
    - 必须成立：假如 客户端调用 QA 或 messages 等核心端点；当 检查请求与响应 JSON 键名；那么 SHALL 仅出现 camelCase 键（如 notebookId/sourceIds/createdAt），且 MUST NOT 依赖 snake_case 键
    假如 客户端调用 QA 或 messages 等核心端点
    当 检查请求与响应 JSON 键名
    那么 SHALL 仅出现 camelCase 键（如 notebookId/sourceIds/createdAt），且 MUST NOT 依赖 snake_case 键

  @req:r285 @human
  场景: no-snake-compat-layer
    - 必须成立：假如 服务端已切换为 camelCase wire；当 客户端仍发送 notebook_id 等 snake_case 字段；那么 系统 SHALL 按校验失败或忽略未知键处理，MUST NOT 同时接受两套字段名作为正式合约
    假如 服务端已切换为 camelCase wire
    当 客户端仍发送 notebook_id 等 snake_case 字段
    那么 系统 SHALL 按校验失败或忽略未知键处理，MUST NOT 同时接受两套字段名作为正式合约

  @req:nested-path-nid-is-ownership-ssot @human
  场景: cross-notebook-source-get-404
    - 必须成立：假如 存在属于 notebook A 的 source；当 客户端用 notebook B 的 notebookId 请求该 source；那么 系统 SHALL 返回 404 NOT_FOUND 且响应为 ErrorEnvelope
    假如 存在属于 notebook A 的 source
    当 客户端用 notebook B 的 notebookId 请求该 source
    那么 系统 SHALL 返回 404 NOT_FOUND 且响应为 ErrorEnvelope

  @req:nested-path-nid-is-ownership-ssot @human
  场景: missing-notebook-id-rejected
    - 必须成立：假如 客户端调用需归属校验的 source/output 单资源端点且省略 notebookId；当 发送请求；那么 系统 SHALL 拒绝该请求（400 校验失败或等价）且 MUST NOT 返回跨本资源体
    假如 客户端调用需归属校验的 source/output 单资源端点且省略 notebookId
    当 发送请求
    那么 系统 SHALL 拒绝该请求（400 校验失败或等价）且 MUST NOT 返回跨本资源体

  @req:notebook-scoped-list-forbid-global @human
  场景: research-list-requires-notebook
    - 必须成立：假如 系统中存在多个 notebook 的记录；当 客户端调用列表端点且省略 notebookId；那么 系统 SHALL 拒绝全表列举（400）且 MUST NOT 返回全部记录
    假如 系统中存在多个 notebook 的记录
    当 客户端调用列表端点且省略 notebookId
    那么 系统 SHALL 拒绝全表列举（400）且 MUST NOT 返回全部记录
