# language: zh-CN
# capability: frontend-eden-migration
# purpose: 固化前端 wire 约定：Eden + shared camelCase、无平行 Api SSOT、SSE 走 /v2、错误信封与 Rstest 夹具一致。本 spec 为持续约束，与 openapi-and-client-generation（Eden 一等 client canonical）互补。
# scope: apps/web/

功能: frontend-eden-migration

  @req:fm2 @human
  场景: Streaming Endpoints
    - Streaming endpoints MUST 使用 fetch（或等价）手动解析 SSE，且 URL MUST 使用 /v2/*；MUST NOT 引用已废弃的 /v1/* API 前缀。

  @req:frontend-sources-must-pass-notebook-id-query @human
  场景: Frontend sources single-item calls MUST pass notebookId query for ownership check
    - 前端调用 sources 单 source 路由（GET/DELETE/re-embed/chunks）MUST 使用嵌套 canonical 路径 `/v2/notebooks/:nid/sources/...` 携带归属上下文（`:nid` 取自前端会话中当前激活 notebook），MUST NOT 附加 notebookId query 平行参数；归属校验语义见 workspace-api-contract nested-path-nid-is-ownership-ssot（canonical）。

  @req:frontend-error-envelope-must-use-shared-parser @human
  场景: Frontend eden error handling MUST use the shared error parser
    - 前端 eden 调用点的错误处理 MUST 经共享的错误解析入口解析 ErrorEnvelope，MUST NOT 在各调用点 inline cast 导致漂移。

  @req:r286 @human
  场景: Frontend MUST NOT snake-to-camel normalize API payloads
    - 在 wire 已为 camelCase 后，前端 MUST NOT 再实现针对 API 载荷的 snake_case→camelCase 字段重命名映射。允许与命名无关的 UI 派生。

  @req:r287 @human
  场景: Web Rstest fixtures MUST use camelCase wire
    - apps/web Rstest/MSW 夹具与断言 MUST 使用 camelCase HTTP/SSE JSON 字段名，MUST NOT 以 snake_case wire 键作为正式期望；just test-web 门禁运行时 MUST 全绿通过。
