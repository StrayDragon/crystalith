# language: zh-CN
# capability: output-rendering-and-typing
# purpose: 定义输出在前端的类型建模与渲染契约：typed payload 判别联合、运行时 guard、通用渲染器与回退路径。该规范确保新输出类型不会破坏渲染链路，并为未知输出提供安全降级。
# scope: apps/server/src/features/outputs/, packages/shared/src/schemas/, apps/web/src/features/workspace/

功能: output-rendering-and-typing

  @req:r197
  规则: Output payload is modeled as discriminated union
    前端 MUST 以 `output.type` 作为判别字段建模 payload，保证类型 narrowing 可用；当输出类型来自插件且客户端未知时，类型系统 MUST 提供一个 "unknown/other" 分支以避免编译期与运行期崩溃。

    场景: unknown-plugin-type-decodes-to-safe-branch
      假如 输出类型来自插件且客户端类型系统不存在该类型
      当 运行 outputPayload.test.ts 的 unknown/other 分支用例
      那么 decodeOutputItem 返回 null 且 normalizeOutputPayload 回退 UnknownOutputPayload（_fallback 标记 + 保留原始字段 + 警告合并）
      而且 编译期与运行期均不崩溃
  @req:r198
  规则: Runtime decode provides safe fallback
    运行时 decoder/guard MUST 在 shape 不匹配时回退到 raw/unknown 渲染，不得崩溃。

    场景: runtime-decode-falls-back-to-raw-json
      假如 GenericOutputRenderer 收到缺失 renderDescriptor 或未知 layout 的输出 content
      当 运行 apps/web/src/features/workspace/domains/outputs/GenericOutputRenderer.test.tsx 的 JSON fallback 用例
      那么 shape 不匹配时回退渲染 raw JSON 且组件不抛错崩溃
      而且 未知 layout 仅记录 console.warn 警告
  @req:r199
  规则: GenericOutputRenderer supports canonical layouts
    通用渲染器 MUST 支持规范布局类型与字段描述符递归渲染。

    场景: canonical-layouts-render-with-nested-fields
      假如 后端返回带 renderDescriptor 的输出 content
      当 运行 GenericOutputRenderer.test.tsx 的 list/cards/timeline/sections/table/tree 布局用例
      那么 各规范布局按 itemSchema 字段描述符渲染出标签与值
      而且 嵌套 children 字段描述符被递归渲染
  @req:r200
  规则: RenderDescriptor contract is stable
    workspace tools 返回的 `renderDescriptor`/`configSchema` 字段语义 MUST 稳定。
  @req:r201
  规则: Rendering priority is deterministic
    渲染优先级 MUST 为 `frontendBundle renderer > GenericOutputRenderer > Raw JSON`： - `frontendBundle renderer`：由后端在 `/v2/workspace/tools` 返回的 `frontendBundle` 声明驱动加载与渲染 - `GenericOutputRenderer`：由后端返回的 `renderDescriptor` 驱动的声明式渲染 - `Raw JSON`：最终安全回退

    场景: frontend-bundle-renderer-takes-priority
      假如 workspace store 已注册 QUIZ 类型的 frontendBundle（apiVersion v1）
      当 运行 apps/web/src/features/workspace/domains/outputs/OutputContentFrontendBundle.test.tsx 的 bundle 渲染用例
      那么 OutputContent 优先渲染 frontendBundle 的 render 导出
      而且 GenericOutputRenderer 与 Raw JSON 仅在 bundle 不可用时依次兜底
  @req:r462

  规则: unsupported-or-broken-bundle-falls-back-safely
    当 `frontendBundle` 的 `apiVersion` 不受支持或 bundle 加载/导出解析失败时，系统 MUST 回退到 `renderDescriptor` 驱动的通用渲染器（若存在），并以 Raw JSON 作为最终安全回退。

    场景: unsupported-or-broken-bundle-safe-fallback
      假如 OutputContent 挂载了 frontendBundle 声明
      当 运行 OutputContentFrontendBundle.test.tsx 的回退用例（apiVersion 非 v1 / 加载被拒 / 无 renderDescriptor）
      那么 apiVersion 不受支持时跳过 bundle 回退到 renderDescriptor 通用渲染
      而且 加载/导出解析失败被 .catch 吸收并以 Raw JSON 作为最终安全回退
  @req:r202
  规则: POST outputs MUST return OutputRead contract
    POST /v2/notebooks/:nid/outputs MUST 返回 camelCase OutputRead 实体（id/notebookId/type/prompt/chunkIds/content/createdAt/updatedAt），与 packages/shared Zod wire 契约一致；MUST NOT 返回 snake_case 或裸 PipelineResult；扁平 /v2/outputs 的登记禁令见 openapi-and-client-generation openapi-documents-nested-canonical-paths（canonical）

    场景: post-outputs-returns-outputread-contract
      假如 笔记本内通过 POST /v2/notebooks/:nid/outputs 登记输出
      当 运行 output-read-contract.test.ts 的 OutputRead 合同用例
      那么 响应按 packages/shared OutputSchema 解析通过且全字段 camelCase（id/notebookId/type/prompt/chunkIds/content/createdAt/updatedAt）
      而且 响应不含 snake_case 字段与裸 PipelineResult 形状（outputId/chunkCount/citations/warnings）
  @req:r203
  规则: Export JSON citations and sources MUST match camelCase wire
    GET /outputs/:id/export?format=json 的 citations MUST 包含 chunkIndex/pageNumber/paragraphIndex/score；sources meta 字段集见 workspace-api-contract qa-export-endpoint（canonical）

    场景: export-json-citations-camelcase
      假如 输出 content 树叶子节点嵌入带 chunkIndex/pageNumber 的 citations
      当 运行 apps/server/tests/outputs/collect-cited-citations.test.ts 的 cited-subset 遍历用例
      那么 收集结果保留 chunkIndex/pageNumber/paragraphIndex/score 等 camelCase 字段
      而且 GET /outputs/:id/export?format=json 的 citations 按该 wire 形状返回
  @req:r204
  规则: Output generation errors MUST map to granular HTTP codes
    输出生成错误 MUST 映射到细分 HTTP 状态码：model 不可用→503、schema 校验失败→422、值错误→400，MUST NOT 统一返回 500

    场景: error-codes-map-to-granular-http-status
      假如 sendError 以各 ErrorCode 逐一调用
      当 运行 apps/server/tests/shared/errors.test.ts 的 canonical status 用例
      那么 SCHEMA_VALIDATION_FAILED 映射 422 且 MODEL_UNAVAILABLE/MODEL_ERROR 映射 503
      而且 值错误映射 400 而非统一 500
  @req:r205
  规则: Outputs endpoint MUST reject SLIDES type with 400 (use studio endpoints)
    outputs 生成端点 MUST 对 type=SLIDES 返回 400 并提示使用 studio slides 端点（对齐既有语义），MUST NOT 把 SLIDES 路由进通用 outputs pipeline。

    场景: outputs-endpoint-rejects-slides-type
      假如 笔记本中有一篇来源
      当 对 outputs 生成端点提交 type=SLIDES（apps/server/tests/bdd/features/outputs/结构化输出.feature 的 SLIDES 拒绝场景）
      那么 响应状态码为 400
      而且 SLIDES 未被路由进通用 outputs pipeline
  @req:r206
  规则: Export MUST support markdown and json formats
    outputs 导出端点 MUST 支持 format=markdown 和 format=json 两种格式，markdown 路径 MUST 按输出类型渲染为可读 markdown

    场景: export-supports-markdown-and-json
      假如 已生成一个 PARAGRAPH 类型输出
      当 对 outputs 导出端点分别请求 format=markdown 与 format=json（同 feature 的两个导出场景）
      那么 两种格式均返回 200
      而且 markdown 路径按输出类型渲染为可读 markdown
  @req:r207
  规则: Convert-to-source MUST use type-aware rendering
    outputs convert-to-source MUST 使用逐类型 markdown 渲染而非原始 JSON 序列化，并按段落分块嵌入

    场景: convert-to-source-type-aware-markdown
      假如 已生成一个 PARAGRAPH 类型输出
      当 调用 outputs convert-to-source（同 feature 的转换场景）
      那么 转换按逐类型 markdown 渲染并按段落分块嵌入新来源
      而且 不使用原始 JSON 序列化
