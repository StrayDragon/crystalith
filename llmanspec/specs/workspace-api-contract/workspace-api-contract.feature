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
    - 当 `app.auth.enabled` 且配置鉴权密钥时，`/v2/**` 端点 MUST 要求 Bearer token，未携带有效 token 的请求 SHALL 返回 401；未启用时 MAY 匿名访问。本条同时是「health 匿名可达」的 canonical 断言：启用鉴权后 `/health` 与 `/health/dependencies` SHALL 保持匿名可访问以支持探活与运维诊断。

  @req:r151 @human
  场景: Non-SSE errors use unified envelope
    - 非 SSE 错误响应 MUST 使用统一错误信封：`errorCode`, `message`, `details?`, `retryAfter?`。所有非 SSE 错误 MUST 经共享错误 helper（或等价入口）返回，HTTP status→errorCode 映射 MUST 来自集中映射表；MUST NOT 返回 {error: string} 等 ad-hoc 形状。

  @req:r151 @executable
  场景: non-sse-error-shape
    假如 一个空白笔记本
    当 请求不存在的笔记本详情
    那么 响应状态码为404
    而且 响应错误码为"NOT_FOUND"

  @req:r186 @human
  场景: Rate limited responses use unified envelope and retryAfter
    - 系统 MUST 为 HTTP rate limiting 提供稳定的对外语义：返回 429，并在统一错误信封中暴露 `retryAfter` 指引。

  @req:r218 @human
  场景: Health endpoints remain exempt from HTTP guardrails
    - 系统健康检查端点（`/health` 与 `/health/dependencies`）在 guardrails 启用语境下 MUST 保持可用于运维探活与诊断，不应因 guardrails 被拒绝；匿名可达性的 canonical 断言见 workspace-api-contract r114。

  @req:r244 @human
  场景: Notebook/session/message endpoints are stable
    - notebook、session、message 的范围归属与 404/400 语义 MUST 稳定。

  @req:r244 @executable
  场景: stable-error-semantics-for-ownership-and-validation
    假如 一个名为"笔记本A"的笔记本
    假如 一个名为"会话A"的会话
    假如 一个名为"笔记本B"的笔记本
    当 从另一个笔记本访问该会话
    那么 响应状态码为404

  @req:r262 @human
  场景: Assistant message content remains plain text while UI is transported out-of-band
    - 系统 MUST 将 assistant 消息 `content: string` 保持为纯文本/markdown 回答，MUST NOT 将结构化 UI 嵌入 `content`；结构化 UI 的 session-scoped `sharedState.ui` 承载语义见 chat-ui-envelope r26/r84。

  @req:r273 @human
  场景: Session UI state endpoints are stable and server-authoritative
    - 系统 MUST 提供 session-scoped UI 状态端点： - `GET /v2/notebooks/{notebookId}/sessions/{sessionId}/ui/state` - `POST /v2/notebooks/{notebookId}/sessions/{sessionId}/ui/event` `GET` MUST 返回 `sessionId`、`sharedState`、`sharedStateRevision`；`POST` MUST 接收 `CUSTOM(name="ui.v1.event")`，并返回 `delta` 与最新 `sharedStateRevision`。携带 `clientRequestId` 与 `baseRevision` 的事件 MUST 做幂等处理与 revision 冲突检查。

  @req:r63 @human
  场景: Prompt presets CRUD endpoints are stable
    - 系统 MUST 提供 prompt presets 的 CRUD 端点集合： - `GET /v2/prompt-presets`：返回 built-in + custom 的 preset 列表 - `POST /v2/prompt-presets`：创建 custom preset 并返回 201 - `PATCH /v2/prompt-presets/{presetId}`：更新 custom preset 并返回更新后的对象 - `DELETE /v2/prompt-presets/{presetId}`：删除 custom preset 并返回 204。创建 trigger 与 built-in 或已存在 custom 冲突的 preset MUST 返回 409；更新或删除不存在的 `presetId` MUST 返回 404。

  @req:r69 @human
  场景: QA endpoints accept in-band prompt directives in question
    - QA 端点 MUST 支持在 `question: string` 中内嵌 `/prompt:<preset> <query>` 指令，并在启用 presets 功能时以该指令选择受控的预设生成策略；指令解析语义的 canonical 约束见 chat-prompt-presets r25。

  @req:r73 @human
  场景: QA endpoints provide stable stream and non-stream contracts
    - QA 端点族（canonical 嵌套路径 `/v2/notebooks/:nid/qa` 与 `/v2/notebooks/:nid/qa/stream`）MUST 保持稳定字段语义，stream 至少包含 `chunk|done|error` 事件。

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
    - `/v2/workspace/tools` 返回的 tools 列表 MUST 由 core 输出类型注册表驱动：包括 `SLIDES` 在内的内置输出类型 MUST 随列表给出且不从列表中隐藏；对当前不可用的能力（插件缺失/禁用/加载失败），客户端 MUST 能呈现不可用原因与可执行恢复提示。生成侧的可用性门禁（OutputTypePlugin 存在性校验、候选唯一性）见 generation-core r31 与 slides-workflow-plugins。

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
    - 系统 MUST 提供 QA 导出端点支持 markdown 与 json 两种格式：markdown 输出 SHALL 以 text/markdown 返回并含 question/answer/citations 三段结构、Notebook ID 行与 Content-Disposition header，citation 行 SHALL 包含 pageNumber/paragraphIndex；JSON 输出 SHALL 顶层含 notebookId，sources meta SHALL 为 sourceId/sourceName/mimeType/parserType 且 notebook-scoped。本条为导出 sources meta 形状的 canonical 约束。

  @req:qa-response-shape @human
  场景: QA responses MUST include evidence and confidence and done-event fields
    - QA 非流式响应 MUST 在 body 中包含 confidence 和 evidence 字段；流式 done 事件 payload MUST 包含 evidence/context/createdAt/confidence/citations/messageId 字段。

  @req:domain-errors-use-envelope-and-status @human
  场景: Domain conflicts use AppHttpError envelope
    - 业务状态机非法与乐观锁冲突 MUST 通过 AppHttpError 返回统一 ErrorEnvelope：乐观锁冲突 MUST 使用 409 CONFLICT；非法状态转换 MUST 使用 400 INVALID_REQUEST 或 409 CONFLICT；MUST NOT 用裸 Error 落入非结构化 500，也 MUST NOT 用 NotFoundError 伪装冲突。

  @req:list-endpoints-use-paginated-envelope @human
  场景: List endpoints MUST use PaginatedSchema envelope
    - notebook-scoped 或可增长的列表端点（至少包括 messages、sessions、sources、outputs、studio slides）MUST 接受 PaginationParams（offset/limit）并 MUST 返回 PaginatedSchema 形状：items、total、offset、limit。MUST NOT 再对上述端点返回无 total 的裸数组作为成功响应。

  @req:list-endpoints-use-paginated-envelope @executable
  场景: messages-paginated
    假如 一个空白笔记本
    假如 一个空白会话
    当 使用分页参数limit=1请求消息列表
    那么 响应状态码为200
    而且 响应中包含"total"字段
    而且 响应中"items"为列表

  @req:process-registries-remain-global-flat @human
  场景: Process registry endpoints MUST remain global flat
    - 进程级 registry 端点 MUST 保持全局扁平且 MUST NOT 嵌套到 /v2/notebooks/:nid/...：至少包括 GET /v2/sources/parsers。另：notebooks 列表、models、commands、prompt-presets、templates MUST 保持扁平。

  @req:nested-path-nid-is-ownership-ssot @human
  场景: Nested path :nid is ownership SSOT
    - 嵌套 canonical 路由上，path :nid MUST 为归属唯一真源；请求 body MUST NOT 再要求必填 notebookId。若 body 携带 notebookId：等于 :nid 时 MUST 忽略；不等于时 MUST 返回 400。响应实体 SHOULD 继续包含 notebookId 字段（兼容读取）。笔记本作用域资源 MUST NOT 再提供扁平 query/body notebookId 平行面。notebook 作用域资源（至少包括 outputs CRUD、qa（含 stream/export）、studio/slides、sources 单资源与 upload）的 canonical HTTP path MUST 为 /v2/notebooks/:nid/<domain>/...，跨 notebook 访问 MUST 返回 404。非嵌套的归属校验端点 MUST 要求显式归属参数（query 或 path）；资源存在但不属于该 notebook 时 MUST 返回 404 且 MUST NOT 按全局 id 返回数据。

  @req:nested-path-nid-is-ownership-ssot @human
  场景: cross-notebook-source-get-404
    - 存在属于 notebook A 的 source 时，若客户端用 notebook B 的 notebookId 请求该 source，系统 SHALL 返回 404 NOT_FOUND 且响应为统一 ErrorEnvelope。

  @req:param-format-validation-envelope @human
  场景: Path id format failures use the unified validation envelope
    - path 中的资源 id 参数格式非法（无法解析为正整数）时，系统 MUST 返回统一 ErrorEnvelope（422 SCHEMA_VALIDATION_FAILED），与 body 校验失败的验证语义一致；query 中可选 id 的宽松解析语义 MAY 保持。资源不存在或不属于该 notebook 时 MUST 保持 404 NOT_FOUND（归属语义见 nested-path-nid-is-ownership-ssot）。

  @req:param-format-validation-envelope @executable
  场景: non-numeric-path-id
    假如 一个空白笔记本
    当 发送 GET 请求"/v2/notebooks/abc/sources"
    那么 响应状态码为422
    而且 响应错误码为"SCHEMA_VALIDATION_FAILED"

  @req:qa-stream-remains-post-with-body @human
  场景: QA stream MUST remain POST with body
    - 交互式 QA SSE（含 notebook 嵌套路径）MUST 使用 POST，并在 body 中携带问题与上下文（sourceIds/策略等）。MUST NOT 要求客户端把大 payload 塞进 query string。

  @req:progress-streams-use-get @human
  场景: Existing-resource progress streams MUST use GET
    - 对已存在资源的进度/订阅类 SSE（至少 studio slides outline/content stream）MUST 使用 GET .../stream。

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
    - 除 URL path 与 SSE event 名称外，对外 HTTP/SSE JSON（请求体、查询参数键、响应体、流式 done/error data）的字段名 MUST 为 camelCase，并以 packages/shared Zod 为 SSOT；MUST NOT 再使用 notebook_id/source_ids/created_at/error_code 等 snake_case wire 别名。对 snake_case 输入系统 SHALL 按校验失败或忽略未知键处理，MUST NOT 同时接受两套字段名作为正式合约。DB 列名不受本要求约束；结构化 content payload 内部的标记键（如 `_postprocessed`、`citations_sanitized` 等 LLM 产出内容内标记）同样不属于 wire 合约字段，不在本约束范围内。

  @req:notebook-scoped-list-forbid-global @human
  场景: Notebook-scoped lists MUST NOT dump all notebooks
    - 笔记本范围列表端点在缺少 notebook 过滤时 MUST 拒绝请求（400）；MUST NOT 返回全部 notebook 的聚合列表。
