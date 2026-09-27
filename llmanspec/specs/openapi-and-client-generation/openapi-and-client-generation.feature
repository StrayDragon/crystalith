# language: zh-CN
# capability: openapi-and-client-generation
# purpose: 定义一等 TypeScript client（Eden）与 OpenAPI 衍生文档面：共享 camelCase Zod SSOT；禁止再引入 hey-api / api/generated 一等 client。
# scope: apps/, packages/

功能: openapi-and-client-generation

  @req:r190
  规则: Eden RPC is the TypeScript client for first-party apps
    Crystalith Web（及未来嵌入同一 HTTP 面的 Tauri webview）MUST 使用 Elysia eden treaty 调用 server API（`import type { App }` + `treaty`）；OpenAPI/Scalar（`/openapi`）MUST 作为人类与外部消费者的文档面与 Eden 同源共存，反映同一份 camelCase Zod schema。平行一等 generated client 的禁令见本 capability r191。
  @req:r191
  规则: First-party apps use Eden only
    一等前端 MUST 仅通过 Eden（及 `@crystalith/shared` 类型）调用 HTTP API；仓库 MUST NOT 再引入 `@hey-api/openapi-ts` 产物、`api/generated/`、`openapi.gen.json` 或平行 wire DTO 目录作为一等 client / SSOT。OpenAPI 文档 MUST 由路由挂载的 Zod 在运行时导出（与 Eden 的同源共存关系见本 capability r190）。
  @req:r192
  规则: Shared Zod schemas are camelCase SSOT for request and response
    前后端共享 Zod schema MUST 放在 `packages/shared/` 且 API 字段 MUST 为 camelCase。Elysia 路由 MUST 挂载相同 schema 做运行时校验；前端 MUST 复用 shared 或 Eden 推断类型。
  @req:r193
  规则: OpenAPI route docs stay synced with mounted Zod
    对外列表与关键读写端点的 registerApiDoc（及路由 query/response Zod 挂载）MUST 与运行时契约同步：分页列表 MUST 文档化为 PaginatedSchema（含 items/total 的分页信封而非裸数组）；文档 path MUST 与 handler 一致。MUST NOT 以过时 apiDocs 路径或裸数组响应描述误导 Scalar/外部消费者。

    场景: route-doc-parity-gate
      假如 全部对外 router 已挂载 shared Zod
      当 运行 apps/server/tests/openapi-generation.test.ts 的 route 与 registerApiDoc parity 检查
      那么 每个 handler 的文档 path/method 与实现一致且分页列表登记为含 items/total 的 PaginatedSchema 信封
      而且 登记过时 apiDocs 路径或裸数组响应描述时 parity 检查失败
  @req:r194
  规则: OpenAPI MUST document nested canonical paths
    registerApiDoc 与 OpenAPI 文档 MUST 以嵌套 /v2/notebooks/:nid/... 为 notebook-scoped 资源的唯一文档真源（如 SHALL 含 /v2/notebooks/{nid}/outputs）。MUST NOT 再登记已删除的扁平 notebook-scoped alias（如 /v2/outputs、/v2/qa、/v2/studio/slides*、扁平 /v2/sources/:id）为可调用操作。进程级 registry（如 GET /v2/sources/parsers）MAY 保持扁平文档。

    场景: nested-canonical-paths-documented
      假如 已由挂载 Zod 生成 OpenAPI 文档
      当 查找 notebook-scoped 资源（如 /v2/notebooks/{nid}/outputs）
      那么 文档仅以嵌套 /v2/notebooks/{nid}/... 登记 notebook-scoped 操作
      而且 不存在 /v2/outputs、/v2/qa、/v2/studio/slides* 或扁平 /v2/sources/:id 的已删除 alias 操作
  @req:r195
  规则: AsyncAPI stream verbs MUST match handlers
    AsyncAPI（及 OpenAPI 中流式端点登记）的 method/path MUST 与 Elysia handler 一致：QA stream POST；studio progress stream GET；researchStream GET `/v2/notebooks/{nid}/research/{rid}/stream`。MUST NOT 文档与实现动词不一致。

    场景: asyncapi-stream-verbs-match-handlers
      假如 已加载全部对外 router 并生成 AsyncAPI 文档
      当 运行 apps/server/tests/asyncapi-verbs.test.ts 对照 Elysia handler
      那么 QA stream 为 POST、studio 流式通道为 GET、researchStream 为 GET /v2/notebooks/{nid}/research/{rid}/stream
      而且 每个流式通道的 method/path 与 handler 完全一致
  @req:r196
  规则: OpenAPI JSON MUST generate without crash
    加载全部对外 router 后，OpenAPI 文档生成（/openapi.json 或等价生成入口）MUST 在合理时间内成功完成且 MUST NOT stack overflow / hang / 因 Zod 转换崩溃。生成结果 MUST 包含关键 path（至少 notebooks、qa、outputs、citations context）。

    场景: openapi-json-generates-without-crash
      假如 已加载全部对外 router
      当 调用 generateOpenApiDocument 生成 /openapi.json（apps/server/tests/openapi-generation.test.ts 首用例）
      那么 生成在合理时间内完成且不 stack overflow、不 hang、不因 Zod 转换崩溃
      而且 生成结果包含 notebooks、qa、outputs、citations context 关键 path
