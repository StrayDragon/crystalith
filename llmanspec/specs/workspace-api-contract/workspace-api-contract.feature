# language: zh-CN
# capability: workspace-api-contract
# purpose: 定义前后端协作所依赖的稳定 API 契约：版本前缀、错误信封、核心端点稳定字段与 SSE 事件最小形状。

功能: workspace-api-contract

  @req:r344
  规则: API major version prefix is stable
    对外业务 API MUST 使用 `/v2` 前缀；同一 major 内保持兼容。健康检查等运维端点 MAY 位于根路径。

    场景: business-api-paths-use-v2-prefix
      假如 e2e 冒烟套件 p0-smoke.spec.ts 就绪
      当 逐条发起其中的业务 API 请求
      那么 全部请求路径均以"/v2"开头
  @req:r346
  规则: Non-SSE errors use unified envelope
    非 SSE 错误响应 MUST 使用统一错误信封：`errorCode`, `message`, `details?`, `retryAfter?`。所有非 SSE 错误 MUST 经共享错误 helper（或等价入口）返回，HTTP status→errorCode 映射 MUST 来自集中映射表；MUST NOT 返回 {error: string} 等 ad-hoc 形状。

    场景: non-sse-error-shape
      假如 一个空白笔记本
      当 请求不存在的笔记本详情
      那么 响应状态码为404
      而且 响应错误码为"NOT_FOUND"
  @req:r347
  规则: Rate limited responses use unified envelope and retryAfter
    系统 MUST 为 HTTP rate limiting 提供稳定的对外语义：返回 429，并在统一错误信封中暴露 `retryAfter` 指引。

    场景: rate-limited-responses-use-unified-envelope
      假如 服务端限流中间件就绪
      当 触发限流并检查响应体
      那么 响应使用统一错误 envelope 且 status 为 429
      而且 envelope 携带 retryAfter 字段
  @req:r348
  规则: Health endpoints remain exempt from HTTP guardrails
    系统健康检查端点（`/health` 与 `/health/dependencies`）在 guardrails 启用语境下 MUST 保持可用于运维探活与诊断，不应因 guardrails 被拒绝；匿名可达性的 canonical 断言见 workspace-api-contract r345。

    场景: health-endpoints-answer-anonymously
      假如 contract-surface 集成环境就绪
      当 未携带任何鉴权头请求 /health、/health/dependencies 与 /v2/health
      那么 三个端点均返回 200 且响应 status 为"ok"
  @req:r349
  规则: Notebook/session/message endpoints are stable
    notebook、session、message 的范围归属与 404/400 语义 MUST 稳定。

    场景: stable-error-semantics-for-ownership-and-validation
      假如 一个名为"笔记本A"的笔记本
      假如 一个名为"会话A"的会话
      假如 一个名为"笔记本B"的笔记本
      当 从另一个笔记本访问该会话
      那么 响应状态码为404
  @req:r350
  规则: Assistant message content remains plain text while UI is transported out-of-band
    系统 MUST 将 assistant 消息 `content: string` 保持为纯文本/markdown 回答，MUST NOT 将结构化 UI 嵌入 `content`；结构化 UI 的 session-scoped `sharedState.ui` 承载语义见 chat-ui-envelope r28/r29。

    场景: assistant-content-remains-plain-string
      假如 qa-session-contract 集成环境就绪（AI mock）
      当 发起非流式问答后读取该会话的消息列表
      那么 非流式响应的 answer 与所有 assistant 消息的 content 均为纯字符串
  @req:r351
  规则: Session UI state is server-authoritative on the session resource
    session-scoped UI 状态由 session 资源服务端权威承载：`GET /v2/notebooks/{notebookId}/sessions/{sessionId}` MUST 返回 `sessionId`、`sharedState` 与 `sharedStateRevision`；更新携带 `sharedState` 时 MUST 校验 `sharedStateRevision`，不匹配返回 409，匹配则写入并递增 revision。前端 UI 恢复 MUST 经 session 资源拉取（chat-ui-envelope r29 同源），不设独立 /ui/* 端点。

    场景: session-resource-carries-ui-state
      假如 某会话存在服务端权威 sharedState
      当 GET 该 session 资源
      那么 响应携带 sessionId、sharedState 与 sharedStateRevision
      而且 PATCH 携写过期 sharedStateRevision 时返回 409 且不写入
  @req:r352
  规则: Prompt presets CRUD endpoints are stable
    系统 MUST 提供 prompt presets 的 CRUD 端点集合： - `GET /v2/prompt-presets`：返回 built-in + custom 的 preset 列表 - `POST /v2/prompt-presets`：创建 custom preset 并返回 201 - `PATCH /v2/prompt-presets/{presetId}`：更新 custom preset 并返回更新后的对象 - `DELETE /v2/prompt-presets/{presetId}`：删除 custom preset 并返回 204。创建 trigger 与 built-in 或已存在 custom 冲突的 preset MUST 返回 409；更新或删除不存在的 `presetId` MUST 返回 404。

    场景: prompt-presets-crud-status-family
      假如 qa-session-contract 集成环境就绪
      当 创建 custom preset、用内置或已存在的 trigger 再次创建、并对缺失的 presetId 执行 PATCH 与 DELETE
      那么 创建返回 201、trigger 冲突返回 409 CONFLICT、缺失 presetId 返回 404 envelope、删除已有 preset 返回 204
  @req:r353
  规则: QA endpoints accept in-band prompt directives in question
    QA 端点 MUST 支持在 `question: string` 中内嵌 `/prompt:<preset> <query>` 指令，并在启用 presets 功能时以该指令选择受控的预设生成策略；指令解析语义的 canonical 约束见 chat-prompt-presets r22。

    场景: question-directive-selects-preset-strategy
      假如 presets 功能已启用
      当 在 question 字段内嵌"/prompt:stats 销售数据"发起问答
      那么 指令由 parsePromptDirective 解析出 preset 与剩余 query
      而且 本次问答按该预设选择受控生成策略
  @req:r354
  规则: QA endpoints provide stable stream and non-stream contracts
    QA 端点族（canonical 嵌套路径 `/v2/notebooks/:nid/qa` 与 `/v2/notebooks/:nid/qa/stream`）MUST 保持稳定字段语义，stream 至少包含 `chunk|done|error` 事件。

    场景: qa-stream-and-non-stream-contracts-stable
      假如 笔记本内已添加可检索的知识源
      当 通过 POST /v2/notebooks/:nid/qa 发起非流式问答
      那么 响应保持稳定的 QA 字段结构
      而且 通过 POST /v2/notebooks/:nid/qa/stream 依次收到 chunk 与 done 事件
  @req:r355
  规则: Citation model remains camelCase within the global camelCase wire
    citation 对象 MUST 继续使用 camelCase（sourceId/sourceName/chunkId/chunkIndex/pageNumber/paragraphIndex/snippet/score），并与全局 wire camelCase 规则一致；MUST NOT 回退 snake_case。

    场景: citation-fields-remain-camel-case
      假如 packages/shared/test/schemas.test.ts 覆盖 CitationSchema
      当 用含 sourceId/chunkIndex 的样例解析 citation 对象
      那么 解析结果保留 sourceId/sourceName/chunkId/chunkIndex/pageNumber/paragraphIndex/snippet/score 字段
      而且 citation 对象不出现 snake_case 字段名
  @req:r356
  规则: Exports can include citations
    系统 MUST 支持将 QA/Outputs 导出为包含 citations 的格式（Markdown/JSON 或等价），以便分享与复盘。

    场景: qa-export-includes-citations
      假如 qa-session-contract 集成环境就绪且 assistant 消息带有 citations
      当 分别请求 format=markdown 与 format=json 的 QA 导出
      那么 markdown 含"## Citations"引用段且 json 的 citations 数组保留完整 citation 对象
  @req:r357
  规则: Workspace tools and outputs endpoints are stable
    `/v2/workspace/tools` 与 outputs/slides 相关端点 MUST 保持可用与向后兼容；其中 `/v2/workspace/tools` 的"可用工具集合"允许随已安装/已启用插件变化而变化，但响应形状与字段语义 MUST 稳定。

    场景: workspace-tools-endpoint-shape-stable
      假如 shared/slides-availability.test.ts 的集成环境就绪
      当 请求 GET /v2/workspace/tools
      那么 响应返回 tools 列表且响应形状与字段语义稳定
  @req:r358
  规则: Workspace tools list returns available tools only
    `/v2/workspace/tools` 返回的 tools 列表 MUST 由 core 输出类型注册表驱动：包括 `SLIDES` 在内的内置输出类型 MUST 随列表给出且不从列表中隐藏；对当前不可用的能力（插件缺失/禁用/加载失败），客户端 MUST 能呈现不可用原因与可执行恢复提示。生成侧的可用性门禁（OutputTypePlugin 存在性校验、候选唯一性）见 generation-core r160 与 slides-workflow-plugins。

    场景: tools-list-registry-includes-slides
      假如 core 输出类型注册表已加载
      当 请求 GET /v2/workspace/tools 并检查 body.tools
      那么 内置输出类型 SLIDES 出现在 tools 列表中
  @req:r359
  规则: Tools endpoint exposes diagnostics in a machine-readable form
    `/v2/workspace/tools` 响应 MUST 暴露 `diagnostics` 字段，用于解释插件能力为什么可用/不可用，并为 UI 与自托管排障提供可执行提示。 `diagnostics` MUST 至少包含： - `diagnostics.plugins.loaded: string[]`：本次启动加载成功的插件 id 列表 - `diagnostics.plugins.skipped: { [pluginId: string]: { errorCode: string, message: string, hint?: string, details?: object } }`：加载被跳过的插件与稳定 skip detail 为覆盖“官方插件未安装（不在 node_modules 的 `@crystalith-plugin/*` scope 内，因此不会被动态 import，也不会出现在 skipped）”的场景，`diagnostics` MUST 额外包含一个轻量的 official catalog（仅字符串/提示，不引入重依赖），用于给出明确的安装/启用指引。 official catalog MUST 覆盖当前版本所定义的**全部官方插件**，包括开箱即用的内置能力与需要显式安装/启用的扩展；当不存在需额外安装的官方扩展时，catalog 允许为空集合。

    场景: tools-diagnostics-are-machine-readable
      假如 slides 能力处于不可用状态
      当 请求 GET /v2/workspace/tools 并读取 diagnostics
      那么 diagnostics 以结构化字段给出 slides 的 errorCode
      而且 附带可执行的 hint 排障提示
  @req:r360
  规则: Workspace tools can expose frontendBundle descriptor
    `/v2/workspace/tools` 返回的 tool 对象 MUST 支持可选字段 `frontendBundle`，用于声明该输出类型的前端渲染 bundle。

    场景: tools-carry-frontend-bundle-descriptor
      假如 contract-surface 集成环境就绪
      当 请求 GET /v2/workspace/tools 并逐个检查 tool 对象
      那么 每个工具对象都携带 frontendBundle 字段且内置输出类型为具体 bundle descriptor
  @req:r361
  规则: Workspace tools expose a complete configSchema
    `/v2/workspace/tools` 返回的工具对象 MUST 包含可直接驱动 UI 的 `configSchema`（如支持主题、数量/难度选项与默认值）。对于 `SLIDES`，该 `configSchema` MUST 覆盖 defaults、quantity / audience / structure / tone / language / density / theme / frontmatter，以及 active plugin 声明的 engine / preview 相关元数据；客户端 MUST NOT 依赖独立 slides config 端点。

    场景: slides-tool-config-schema-complete
      假如 contract-surface 集成环境就绪
      当 请求 GET /v2/workspace/tools 并读取 SLIDES 工具的 configSchema
      那么 configSchema 覆盖 defaults（含 frontmatter）、全部选项族与 engine/preview 元数据
  @req:r362
  规则: Tool config endpoint stays consistent (if present)
    若 `/v2/workspace/tools/{toolId}/config` 端点存在，其返回值 MUST 与 tools 列表中的 `configSchema` 语义一致。

    场景: tool-config-endpoint-consistent-with-list
      假如 contract-surface 集成环境就绪
      当 分别读取 tools 列表与 GET /v2/workspace/tools/slides/config 的返回
      那么 config 端点的 defaults 与 tools 列表中 SLIDES 的 configSchema.defaults 一致
  @req:r363
  规则: Models list MUST return providers field on the list envelope (not only separate endpoint)
    models 列表端点 MUST 在响应 envelope 返回 providers 字段；MAY 另提供 /models/providers。

    场景: models-list-envelope-carries-providers
      假如 contract-surface 集成环境就绪
      当 请求 GET /v2/models
      那么 响应 envelope 顶层携带 providers 字符串数组且包含"openai"
  @req:r364
  规则: Models endpoints MUST filter by provider availability
    models GET list 与 GET single MUST 按 provider 可用性过滤：不可用 provider 的 model 不出现在 list；GET single SHALL 404。

    场景: models-filter-by-provider-availability
      假如 contract-surface 集成环境就绪且配置了一个未知 provider 的模型
      当 请求 GET /v2/models 与 GET /v2/models/:modelId
      那么 未知 provider 的模型不出现在列表中
      而且 GET single 未知 provider 的模型返回 404 envelope
  @req:r365
  规则: Sessions convert-to-source and convert-to-output MUST honor messageIds filter
    sessions 的 convert-to-source 与 convert-to-output MUST 接受可选 messageIds：仅转换指定消息；缺失 id 时 404。省略 messageIds 时 MAY 转换会话全部消息。

    场景: convert-honors-message-ids-filter
      假如 qa-session-contract 集成环境就绪且会话内有多条消息
      当 携带 messageIds 子集发起 convert-to-source 与 convert-to-output
      那么 仅指定消息被转换且 messageCount 反映子集大小
      而且 携带缺失的 message id 时返回 404 envelope
  @req:r366
  规则: Sessions convert text format MUST match v1 role labels and separators
    sessions convert-to-source MUST 使用中文角色标签与稳定分隔；convert-to-output MUST 使用 raw 文本（无角色前缀）。

    场景: convert-text-format-v1-labels
      假如 qa-session-contract 集成环境就绪且会话内有用户与助手消息各一条
      当 分别发起 convert-to-source 与 convert-to-output 并读取转换文本
      那么 convert-to-source 的文本为"**用户**: …"与"**助手**: …"标签并以空行分隔
      而且 convert-to-output 的文本不含角色前缀
  @req:r45
  规则: Session convert-to-output MUST collect chunkIds from citations
    session convert-to-output MUST 从消息 citations 中收集 chunkIds 并附加到创建的 output。

    场景: convert-to-output-attaches-citation-chunk-ids
      假如 qa-session-contract 集成环境就绪且会话内助手消息携带含 chunkId 的 citations
      当 发起 convert-to-output
      那么 创建的 output 附带去重后的 chunkIds 集合
  @req:r367
  规则: Models response MUST put defaults on envelope (not inline per-model) for list endpoint
    models 列表端点 MUST 在 envelope 顶层提供 `defaults`；列表项 MAY 额外携带 isDefaultChat/isDefaultEmbedding。GET single MUST NOT 要求默认标记字段。

    场景: models-defaults-on-envelope
      假如 contract-surface 集成环境就绪
      当 请求 GET /v2/models 并检查 envelope
      那么 defaults 位于 envelope 顶层且 chat/embedding 指向已配置的默认模型
      而且 列表项携带 isDefaultChat/isDefaultEmbedding 标记
  @req:r368
  规则: API MUST provide QA export endpoint with stable export shape
    系统 MUST 提供 QA 导出端点支持 markdown 与 json 两种格式：markdown 输出 SHALL 以 text/markdown 返回并含 question/answer/citations 三段结构、Notebook ID 行与 Content-Disposition header，citation 行 SHALL 包含 pageNumber/paragraphIndex；JSON 输出 SHALL 顶层含 notebookId，sources meta SHALL 为 sourceId/sourceName/mimeType/parserType 且 notebook-scoped。本条为导出 sources meta 形状的 canonical 约束。

    场景: qa-export-stable-shape
      假如 qa-session-contract 集成环境就绪且会话内有带 citations 的 assistant 消息
      当 分别请求 format=markdown 与 format=json 的 QA 导出
      那么 markdown 以 text/markdown 返回、含 Content-Disposition 与 question/answer/citations 三段及 Notebook ID 行
      而且 citation 行包含 pageNumber/paragraphIndex
      而且 json 顶层含 notebookId 且 sources meta 为 notebook-scoped 的 sourceId/sourceName/mimeType/parserType
  @req:r369
  规则: QA responses MUST include evidence and confidence and done-event fields
    QA 非流式响应 MUST 在 body 中包含 confidence 和 evidence 字段；流式 done 事件 payload MUST 包含 evidence/context/createdAt/confidence/citations/messageId 字段。

    场景: qa-confidence-evidence-and-done-fields
      假如 qa-session-contract 集成环境就绪（AI mock）
      当 发起非流式问答与流式问答并读取 SSE done 事件
      那么 非流式 body 包含 confidence 与 evidence 字段
      而且 done 事件 payload 包含 evidence/context/createdAt/confidence/citations/messageId 字段
  @req:r370
  规则: Domain conflicts use AppHttpError envelope
    业务状态机非法与乐观锁冲突 MUST 通过 AppHttpError 返回统一 ErrorEnvelope：乐观锁冲突 MUST 使用 409 CONFLICT；非法状态转换 MUST 使用 400 INVALID_REQUEST 或 409 CONFLICT；MUST NOT 用裸 Error 落入非结构化 500，也 MUST NOT 用 NotFoundError 伪装冲突。

    场景: domain-conflicts-use-app-http-error-envelope
      假如 notebook-isolation 集成环境就绪
      当 触发乐观锁冲突并检查响应体
      那么 响应经 AppHttpError 返回统一 ErrorEnvelope 且状态码为409
      而且 非法状态转换不会落入非结构化 500
  @req:r371
  规则: List endpoints MUST use PaginatedSchema envelope
    notebook-scoped 或可增长的列表端点（至少包括 messages、sessions、sources、outputs、studio slides）MUST 接受 PaginationParams（offset/limit）并 MUST 返回 PaginatedSchema 形状：items、total、offset、limit。MUST NOT 再对上述端点返回无 total 的裸数组作为成功响应。

    场景: messages-paginated
      假如 一个空白笔记本
      假如 一个空白会话
      当 使用分页参数limit=1请求消息列表
      那么 响应状态码为200
      而且 响应中包含"total"字段
      而且 响应中"items"为列表
  @req:r372
  规则: Process registry endpoints MUST remain global flat
    进程级 registry 端点 MUST 保持全局扁平且 MUST NOT 嵌套到 /v2/notebooks/:nid/...：至少包括 GET /v2/sources/parsers。另：notebooks 列表、models、commands、prompt-presets、templates MUST 保持扁平。

    场景: process-registries-stay-global-flat
      假如 contract-surface 集成环境就绪
      当 请求 GET /v2/sources/parsers 与 notebooks、models、prompt-presets、templates 的扁平列表
      那么 各 registry 在全局扁平路径返回 200
      而且 /v2/notebooks/:nid/sources/parsers 不提供嵌套的 registry 响应
  @req:r373
  规则: Nested path :nid is ownership SSOT
    嵌套 canonical 路由上，path :nid MUST 为归属唯一真源；请求 body MUST NOT 再要求必填 notebookId。若 body 携带 notebookId：等于 :nid 时 MUST 忽略；不等于时 MUST 返回 400。响应实体 SHOULD 继续包含 notebookId 字段（兼容读取）。笔记本作用域资源 MUST NOT 再提供扁平 query/body notebookId 平行面。notebook 作用域资源（至少包括 outputs CRUD、qa（含 stream/export）、studio/slides、sources 单资源与 upload）的 canonical HTTP path MUST 为 /v2/notebooks/:nid/<domain>/...，跨 notebook 访问 MUST 返回 404。非嵌套的归属校验端点 MUST 要求显式归属参数（query 或 path）；资源存在但不属于该 notebook 时 MUST 返回 404 且 MUST NOT 按全局 id 返回数据。

    场景: nested-path-nid-is-ownership-ssot
      假如 notebook-isolation 集成环境就绪
      当 通过 /v2/notebooks/:nid/outputs 等嵌套路径访问资源
      那么 归属判定仅依据路径 :nid 且 body 无需必填 notebookId
      而且 body notebookId 与 :nid 不一致时返回 400
      而且 跨 notebook 访问时返回 404
  @req:r470

  规则: cross-notebook-source-get-404
    存在属于 notebook A 的 source 时，若客户端用 notebook B 的 notebookId 请求该 source，系统 SHALL 返回 404 NOT_FOUND 且响应为统一 ErrorEnvelope。

    场景: cross-notebook-source-get-returns-404-envelope
      假如 notebook A 中已有 status 为 ready 的 source
      当 用 notebook B 的 notebookId 发起 GET /v2/notebooks/:nid/sources/:sid
      那么 响应状态码为404
      而且 响应为统一 ErrorEnvelope 且错误码为"NOT_FOUND"
  @req:r374
  规则: Path id format failures use the unified validation envelope
    path 中的资源 id 参数格式非法（无法解析为正整数）时，系统 MUST 返回统一 ErrorEnvelope（422 SCHEMA_VALIDATION_FAILED），与 body 校验失败的验证语义一致；query 中可选 id 的宽松解析语义 MAY 保持。资源不存在或不属于该 notebook 时 MUST 保持 404 NOT_FOUND（归属语义见 nested-path-nid-is-ownership-ssot）。

    场景: non-numeric-path-id
      假如 一个空白笔记本
      当 发送 GET 请求"/v2/notebooks/abc/sources"
      那么 响应状态码为422
      而且 响应错误码为"SCHEMA_VALIDATION_FAILED"
  @req:r375
  规则: QA stream MUST remain POST with body
    交互式 QA SSE（含 notebook 嵌套路径）MUST 使用 POST，并在 body 中携带问题与上下文（sourceIds/策略等）。MUST NOT 要求客户端把大 payload 塞进 query string。

    场景: qa-stream-uses-post-with-body
      假如 bdd runner 的 SSE helper 就绪且笔记本内有知识源
      当 通过 POST /v2/notebooks/:nid/qa/stream 在 body 携带 question 与 sourceIds
      那么 SSE 连接建立并按合约产出事件
      而且 问题 payload 无需塞入 query string
  @req:r376
  规则: Existing-resource progress streams MUST use GET
    对已存在资源的进度/订阅类 SSE（至少 studio slides outline/content stream）MUST 使用 GET .../stream。

    场景: slides-progress-stream-uses-get
      假如 apps/web 的 consumeSlidesStageStream 测试面就绪
      当 以 GET 请求 studio slides 的 outline/content 进度 SSE
      那么 连接按 GET 建立并接收阶段进度事件
  @req:r377
  规则: Output list MUST omit full content
    outputs（Studio 笔记）列表端点成功响应中的每个 item MUST NOT 包含完整 generation payload / 长 markdown 正文。item MUST 至少含标识与展示所需元数据（如 id、type、title、status、timestamps）；可选短 preview。完整正文 MUST 仅由单条详情端点返回。

    场景: output-list-omits-full-content
      假如 笔记本中已有含长 markdown 正文的 output
      当 请求 GET /v2/notebooks/:nid/outputs 列表
      那么 每个 item 不包含完整 generation payload 或长 markdown 正文
      而且 item 携带 id/type/title/status 等展示元数据
  @req:r378
  规则: Output detail MUST return full content
    GET 单条 output（notebook-scoped）MUST 返回渲染所需的完整内容字段。客户端在用户选中/打开条目前 MUST NOT 依赖 list 内嵌全文。

    场景: output-detail-returns-full-content
      假如 笔记本中已有含长 markdown 正文的 output
      当 请求 GET /v2/notebooks/:nid/outputs/:outputId 单条详情
      那么 响应包含渲染所需的完整内容字段
  @req:r379
  规则: CitationSchema SSOT is camelCase in packages/shared
    packages/shared 的 CitationSchema MUST 以 camelCase 字段作为 Zod SSOT，并驱动 OpenAPI/eden 类型；服务端序列化与前端消费 MUST 直接使用该 schema 推断类型，不得并行维护一套 snake_case Citation 线类型。

    场景: citation-schema-ssot-drives-wire-types
      假如 packages/shared/test/schemas.test.ts 覆盖 CitationSchema
      当 检查该 Zod SSOT 推断的 OpenAPI 与 eden 类型
      那么 类型字段与 camelCase schema 推断一致
      而且 仓库不存在并行的 snake_case Citation 线类型
  @req:r380
  规则: HTTP JSON wire fields MUST be camelCase end-to-end
    除 URL path 与 SSE event 名称外，对外 HTTP/SSE JSON（请求体、查询参数键、响应体、流式 done/error data）的字段名 MUST 为 camelCase，并以 packages/shared Zod 为 SSOT；MUST NOT 再使用 notebook_id/source_ids/created_at/error_code 等 snake_case wire 别名。对 snake_case 输入系统 SHALL 按校验失败或忽略未知键处理，MUST NOT 同时接受两套字段名作为正式合约。DB 列名不受本要求约束；结构化 content payload 内部的标记键（如 `_postprocessed`、`citations_sanitized` 等 LLM 产出内容内标记）同样不属于 wire 合约字段，不在本约束范围内。

    场景: wire-fields-are-camel-case-end-to-end
      假如 packages/shared 的 Zod wire 契约通过 schemas.test.ts 校验
      当 检查请求体、响应体与 SSE done 事件的字段名
      那么 对外 JSON 字段均为 camelCase
      而且 notebook_id/error_code 等 snake_case 别名不再作为正式合约字段
  @req:r381
  规则: Notebook-scoped lists MUST NOT dump all notebooks
    笔记本范围列表端点在缺少 notebook 过滤时 MUST 拒绝请求（400）；MUST NOT 返回全部 notebook 的聚合列表。

    场景: scoped-lists-never-dump-all-notebooks
      假如 contract-surface 集成环境就绪且存在两个笔记本
      当 请求不带 notebook 过滤的扁平作用域列表路径（如 /v2/outputs、/v2/sources）
      那么 请求被统一错误 envelope 拒绝且不返回跨笔记本聚合列表
      而且 嵌套列表路径仅返回该笔记本自己的行
