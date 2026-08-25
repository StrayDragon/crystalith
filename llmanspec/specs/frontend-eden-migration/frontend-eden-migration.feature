# language: zh-CN
# capability: frontend-eden-migration
# purpose: 固化前端 wire 约定：Eden + shared camelCase、无平行 Api SSOT、SSE 走 /v2、错误信封与 Vitest 夹具一致。本 spec 为持续约束，与 openapi-and-client-generation（Eden 一等 client canonical）互补。
# scope: apps/web/

功能: frontend-eden-migration

  @req:fm2 @human
  场景: Streaming Endpoints
    - Streaming endpoints MUST 使用 fetch（或等价）手动解析 SSE，且 URL MUST 使用 /v2/*；MUST NOT 引用已废弃的 /v1/* API 前缀。

  @req:frontend-sources-must-pass-notebook-id-query @human
  场景: Frontend sources single-item calls MUST pass notebookId query for ownership check
    - 前端调用 sources 单 source 路由（GET/DELETE/re-embed/chunks）MUST 传递 notebookId query 以激活归属校验，notebookId 取自前端会话中当前激活 notebook。

  @req:frontend-error-envelope-must-use-shared-parser @human
  场景: Frontend eden error handling MUST use the shared error parser
    - 前端 eden 调用点的错误处理 MUST 经共享的错误解析入口解析 ErrorEnvelope，MUST NOT 在各调用点 inline cast 导致漂移。

  @req:r286 @human
  场景: Frontend MUST NOT snake-to-camel normalize API payloads
    - 在 wire 已为 camelCase 后，前端 MUST NOT 再实现针对 API 载荷的 snake_case→camelCase 字段重命名映射。允许与命名无关的 UI 派生。

  @req:r287 @human
  场景: Web Vitest fixtures MUST use camelCase wire
    - apps/web Vitest/MSW 夹具与断言 MUST 使用 camelCase HTTP/SSE JSON 字段名。MUST NOT 以 snake_case wire 键作为正式期望。

  @req:fm2 @human
  场景: streaming-uses-v2
    - 必须成立：当 发起 QA/studio 等流式请求；那么 请求 URL SHALL 使用 /v2/ 前缀
    当 发起 QA/studio 等流式请求
    那么 请求 URL SHALL 使用 /v2/ 前缀

  @req:frontend-sources-must-pass-notebook-id-query @human
  场景: delete-passes-notebookId
    - 必须成立：当 用户在 notebook A 删除来源；那么 DELETE /sources/:id SHALL 包含 ?notebookId=A
    当 用户在 notebook A 删除来源
    那么 DELETE /sources/:id SHALL 包含 ?notebookId=A

  @req:frontend-error-envelope-must-use-shared-parser @human
  场景: dedup-error-parsed-via-helper
    - 必须成立：当 eden 返回 SOURCE_DEDUP_HIT；那么 前端 SHALL 经共享错误解析入口提取 errorCode
    当 eden 返回 SOURCE_DEDUP_HIT
    那么 前端 SHALL 经共享错误解析入口提取 errorCode

  @req:r286 @human
  场景: normalize-snake-maps-removed
    - 必须成立：当 审查 apps/web normalize*；那么 SHALL 不存在 notebook_id→notebookId 这类 API 字段重命名逻辑
    当 审查 apps/web normalize*
    那么 SHALL 不存在 notebook_id→notebookId 这类 API 字段重命名逻辑

  @req:r287 @human
  场景: vitest-camel-fixtures
    - 必须成立：当 运行 just test-web；那么 SHALL 全绿且 mock/断言使用 camelCase 字段
    当 运行 just test-web
    那么 SHALL 全绿且 mock/断言使用 camelCase 字段
