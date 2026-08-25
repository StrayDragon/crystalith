# language: zh-CN
# capability: openapi-and-client-generation
# purpose: 定义一等 TypeScript client（Eden）与 OpenAPI 衍生文档面：共享 camelCase Zod SSOT；禁止再引入 hey-api / api/generated 一等 client。
# scope: apps/, packages/

功能: openapi-and-client-generation

  @req:r37 @human
  场景: Eden RPC is the TypeScript client for first-party apps
    - Crystalith Web（及未来嵌入同一 HTTP 面的 Tauri webview）MUST 使用 Elysia eden treaty 调用 server API（`import type { App }` + `treaty`）。MUST NOT 使用 @hey-api/openapi-ts 生成新的一等 client。OpenAPI/Scalar（`/openapi`）MUST 继续作为人类与外部消费者的文档面，与 Eden 并行存在。

  @req:r95 @human
  场景: First-party apps use Eden only
    - 一等前端 MUST 仅通过 Eden（及 `@crystalith/shared` 类型）调用 HTTP API。仓库 MUST NOT 再引入 `api/generated/`、`openapi.gen.json` 一等 client 或平行 wire DTO 目录作为 SSOT；OpenAPI 文档 MUST 由路由挂载的 Zod 在运行时导出。

  @req:r132 @human
  场景: Shared Zod schemas are camelCase SSOT for request and response
    - 前后端共享 Zod schema MUST 放在 `packages/shared/` 且 API 字段 MUST 为 camelCase。Elysia 路由 MUST 挂载相同 schema 做运行时校验；前端 MUST 复用 shared 或 Eden 推断类型。

  @req:openapi-route-docs-stay-synced @human
  场景: OpenAPI route docs stay synced with mounted Zod
    - 对外列表与关键读写端点的 registerApiDoc（及路由 query/response Zod 挂载）MUST 与运行时契约同步：分页列表 MUST 文档化为 PaginatedSchema；文档 path MUST 与 handler 一致。MUST NOT 以过时 apiDocs 路径或裸数组响应描述误导 Scalar/外部消费者。

  @req:openapi-documents-nested-canonical-paths @human
  场景: OpenAPI MUST document nested canonical paths
    - registerApiDoc 与 OpenAPI 文档 MUST 以嵌套 /v2/notebooks/:nid/... 为 notebook-scoped 资源的唯一文档真源。MUST NOT 再登记已删除的扁平 notebook-scoped alias（如 /v2/outputs、/v2/qa、/v2/studio/slides*、扁平 /v2/sources/:id）。进程级 registry（如 GET /v2/sources/parsers）MAY 保持扁平文档。

  @req:asyncapi-stream-verbs-match-handlers @human
  场景: AsyncAPI stream verbs MUST match handlers
    - AsyncAPI（及 OpenAPI 中流式端点登记）的 method/path MUST 与 Elysia handler 一致：QA stream POST；studio progress stream GET；ResearchRun stream GET。MUST NOT 文档与实现动词不一致。

  @req:openapi-json-generates-without-crash @human
  场景: OpenAPI JSON MUST generate without crash
    - 加载全部对外 router 后，OpenAPI 文档生成（/openapi.json 或等价生成入口）MUST 在合理时间内成功完成且 MUST NOT stack overflow / hang。生成结果 MUST 包含关键 path（至少 notebooks、qa、outputs、citations context）。

  @req:r37 @human
  场景: eden-and-openapi-coexist
    - 必须成立：当 检查前端依赖与 /openapi；那么 前端 SHALL 通过 eden 调用 API，且 OpenAPI/Scalar SHALL 可访问并反映 camelCase schema
    当 检查前端依赖与 /openapi
    那么 前端 SHALL 通过 eden 调用 API，且 OpenAPI/Scalar SHALL 可访问并反映 camelCase schema

  @req:r95 @human
  场景: no-generated-client
    - 必须成立：当 搜索 apps/web 对 api/generated 的依赖；那么 SHALL 无此类 import
    当 搜索 apps/web 对 api/generated 的依赖
    那么 SHALL 无此类 import

  @req:r132 @human
  场景: openapi-reflects-camelcase
    - 必须成立：当 查看 /openapi.json 或 Scalar；那么 文档中的 schema 属性名 SHALL 为 camelCase
    当 查看 /openapi.json 或 Scalar
    那么 文档中的 schema 属性名 SHALL 为 camelCase

  @req:openapi-route-docs-stay-synced @human
  场景: paginated-list-documented
    - 必须成立：假如 列表已改为 PaginatedSchema；当 检查对应 registerApiDoc responses；那么 文档 SHALL 描述含 items/total 的分页信封而非仅裸数组
    假如 列表已改为 PaginatedSchema
    当 检查对应 registerApiDoc responses
    那么 文档 SHALL 描述含 items/total 的分页信封而非仅裸数组

  @req:openapi-documents-nested-canonical-paths @human
  场景: outputs-nested-in-docs
    - 必须成立：假如 outputs 已挂载嵌套路径；当 检查 registerApiDoc / OpenAPI；那么 文档 SHALL 含 /v2/notebooks/{nid}/outputs 且 MUST NOT 登记已删扁平 /v2/outputs 为可调用操作
    假如 outputs 已挂载嵌套路径
    当 检查 registerApiDoc / OpenAPI
    那么 文档 SHALL 含 /v2/notebooks/{nid}/outputs 且 MUST NOT 登记已删扁平 /v2/outputs 为可调用操作

  @req:openapi-documents-nested-canonical-paths @human
  场景: no-flat-alias-in-docs
    - 必须成立：假如 flat notebook-scoped aliases 已从路由删除；当 检查 registerApiDoc / OpenAPI；那么 文档 SHALL 含嵌套 /v2/notebooks/{nid}/outputs 等且 MUST NOT 再登记已删扁平 alias 为可调用操作
    假如 flat notebook-scoped aliases 已从路由删除
    当 检查 registerApiDoc / OpenAPI
    那么 文档 SHALL 含嵌套 /v2/notebooks/{nid}/outputs 等且 MUST NOT 再登记已删扁平 alias 为可调用操作

  @req:asyncapi-stream-verbs-match-handlers @human
  场景: research-asyncapi-get
    - 必须成立：假如 ResearchRun stream handler 已挂载；当 检查 AsyncAPI address/method；那么 researchStream SHALL 登记为 GET `/v2/notebooks/{nid}/research/{rid}/stream`
    假如 ResearchRun stream handler 已挂载
    当 检查 AsyncAPI address/method
    那么 researchStream SHALL 登记为 GET `/v2/notebooks/{nid}/research/{rid}/stream`

  @req:openapi-json-generates-without-crash @human
  场景: openapi-json-smoke
    - 必须成立：假如 server 已挂载全部对外路由；当 请求 /openapi.json 或运行文档生成；那么 进程 SHALL 成功返回 OpenAPI 文档且含关键 path，MUST NOT 因 Zod 转换崩溃
    假如 server 已挂载全部对外路由
    当 请求 /openapi.json 或运行文档生成
    那么 进程 SHALL 成功返回 OpenAPI 文档且含关键 path，MUST NOT 因 Zod 转换崩溃
