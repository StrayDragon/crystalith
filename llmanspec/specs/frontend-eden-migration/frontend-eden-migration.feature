# language: zh-CN
# capability: frontend-eden-migration
# purpose: 固化前端 wire 约定：Eden + shared camelCase、无平行 Api SSOT、SSE 走 /v2、错误信封与 Rstest 夹具一致。本 spec 为持续约束，与 openapi-and-client-generation（Eden 一等 client canonical）互补。
# scope: apps/web/

功能: frontend-eden-migration

  @req:r155
  规则: Streaming Endpoints
    Streaming endpoints MUST 使用 fetch（或等价）手动解析 SSE，且 URL MUST 使用 /v2/*；MUST NOT 引用已废弃的 /v1/* API 前缀。

    场景: stream-manually-parses-sse-over-v2
      假如 前端流式调用入口就绪
      当 运行 apps/web/src/api/stream.test.ts 的 SSE 解析用例
      那么 fetch（或等价）手动解析 event/data 帧且 URL 使用 /v2/* 前缀
      而且 不引用已废弃的 /v1/* API 前缀
  @req:r156
  规则: Frontend sources single-item calls MUST pass notebookId query for ownership check
    前端调用 sources 单 source 路由（GET/DELETE/re-embed/chunks）MUST 使用嵌套 canonical 路径 `/v2/notebooks/:nid/sources/...` 携带归属上下文（`:nid` 取自前端会话中当前激活 notebook），MUST NOT 附加 notebookId query 平行参数；归属校验语义见 workspace-api-contract nested-path-nid-is-ownership-ssot（canonical）。

    场景: sources-single-item-uses-nested-path
      假如 前端会话中已有当前激活 notebook
      当 运行 useSources.test.tsx 的 MSW 夹具嵌套路径用例
      那么 sources 单项调用（GET/DELETE/re-embed/chunks）请求 /v2/notebooks/:nid/sources/... 且 :nid 取自当前激活 notebook
      而且 请求不附加 notebookId query 平行参数
  @req:r157
  规则: Frontend eden error handling MUST use the shared error parser
    前端 eden 调用点的错误处理 MUST 经共享的错误解析入口解析 ErrorEnvelope，MUST NOT 在各调用点 inline cast 导致漂移。

    场景: eden-errors-via-shared-parser
      假如 前端 eden 调用点收到错误响应
      当 运行 apps/web/src/api/parseServerError.test.ts 的解析用例
      那么 parseServerError 统一解析 Eden treaty 的嵌套错误形状（status 与 value 中的 ErrorEnvelope）
      而且 各调用点不做 inline cast 导致漂移
  @req:r158
  规则: Frontend MUST NOT snake-to-camel normalize API payloads
    在 wire 已为 camelCase 后，前端 MUST NOT 再实现针对 API 载荷的 snake_case→camelCase 字段重命名映射。允许与命名无关的 UI 派生。
  @req:r159
  规则: Web Rstest fixtures MUST use camelCase wire
    apps/web Rstest/MSW 夹具与断言 MUST 使用 camelCase HTTP/SSE JSON 字段名，MUST NOT 以 snake_case wire 键作为正式期望；just test-web 门禁运行时 MUST 全绿通过。
