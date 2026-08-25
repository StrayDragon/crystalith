# language: zh-CN
# capability: output-rendering-and-typing
# purpose: 定义输出在前端的类型建模与渲染契约：typed payload 判别联合、运行时 guard、通用渲染器与回退路径。该规范确保新输出类型不会破坏渲染链路，并为未知输出提供安全降级。
# scope: src/, tests/

功能: output-rendering-and-typing

  @req:r38 @human
  场景: Output payload is modeled as discriminated union
    - 前端 MUST 以 `output.type` 作为判别字段建模 payload，保证类型 narrowing 可用；当输出类型来自插件且客户端未知时，类型系统 MUST 提供一个 "unknown/other" 分支以避免编译期与运行期崩溃。

  @req:r96 @human
  场景: Runtime decode provides safe fallback
    - 运行时 decoder/guard MUST 在 shape 不匹配时回退到 raw/unknown 渲染，不得崩溃。

  @req:r133 @human
  场景: GenericOutputRenderer supports canonical layouts
    - 通用渲染器 MUST 支持规范布局类型与字段描述符递归渲染。

  @req:r169 @human
  场景: RenderDescriptor contract is stable
    - workspace tools 返回的 `renderDescriptor`/`configSchema` 字段语义 MUST 稳定。

  @req:r202 @human
  场景: Rendering priority is deterministic
    - 渲染优先级 MUST 为 `frontendBundle renderer > GenericOutputRenderer > Raw JSON`： - `frontendBundle renderer`：由后端在 `/v2/workspace/tools` 返回的 `frontendBundle` 声明驱动加载与渲染 - `GenericOutputRenderer`：由后端返回的 `renderDescriptor` 驱动的声明式渲染 - `Raw JSON`：最终安全回退

  @req:outputs-response-contract @human
  场景: POST outputs MUST return OutputRead contract
    - POST /v2/notebooks/:nid/outputs MUST 返回 camelCase OutputRead 实体（id/notebookId/type/prompt/chunkIds/content/createdAt/updatedAt），与 packages/shared Zod wire 契约一致；MUST NOT 返回 snake_case 或裸 PipelineResult；MUST NOT 再登记扁平 /v2/outputs 作为可用路径

  @req:outputs-export-fields @human
  场景: Export JSON citations and sources MUST match camelCase wire
    - GET /outputs/:id/export?format=json 的 citations MUST 包含 chunkIndex/pageNumber/paragraphIndex/score；sources MUST 使用 {sourceId,sourceName,mimeType,parserType} 字段名

  @req:outputs-error-mapping @human
  场景: Output generation errors MUST map to granular HTTP codes
    - 输出生成错误 MUST 映射到细分 HTTP 状态码：model 不可用→503、schema 校验失败→422、值错误→400，MUST NOT 统一返回 500

  @req:outputs-slides-must-be-rejected-at-outputs-endpoint @human
  场景: Outputs endpoint MUST reject SLIDES type with 400 (use studio endpoints)
    - outputs 生成端点 MUST 对 type=SLIDES 返回 400 并提示使用 studio slides 端点（对齐既有语义），MUST NOT 把 SLIDES 路由进通用 outputs pipeline。

  @req:outputs-export-format @human
  场景: Export MUST support markdown and json formats
    - outputs 导出端点 MUST 支持 format=markdown 和 format=json 两种格式，markdown 路径 MUST 按输出类型渲染为可读 markdown

  @req:outputs-convert-type-aware @human
  场景: Convert-to-source MUST use type-aware rendering
    - outputs convert-to-source MUST 使用逐类型 markdown 渲染而非原始 JSON 序列化，并按段落分块嵌入

  @req:r38 @human
  场景: type-narrowing-supports-unknown-plugin-output-types
    - 必须成立：当 前端收到一个带有未知 `output.type` 的输出 payload（未在客户端枚举/联合类型中声明）；那么 系统 SHALL 将其归入 unknown 分支并进入安全降级渲染路径
    当 前端收到一个带有未知 `output.type` 的输出 payload（未在客户端枚举/联合类型中声明）
    那么 系统 SHALL 将其归入 unknown 分支并进入安全降级渲染路径

  @req:r96 @human
  场景: unknown-output-shape-does-not-crash-ui
    - 必须成立：当 输出 payload 的 shape 与预期类型不匹配；那么 系统 SHALL 回退到 raw/unknown 渲染并保持 UI 不崩溃
    当 输出 payload 的 shape 与预期类型不匹配
    那么 系统 SHALL 回退到 raw/unknown 渲染并保持 UI 不崩溃

  @req:r133 @human
  场景: render-canonical-layout
    - 必须成立：当 输出使用规范布局与字段描述符；那么 GenericOutputRenderer SHALL 能递归渲染该布局
    当 输出使用规范布局与字段描述符
    那么 GenericOutputRenderer SHALL 能递归渲染该布局

  @req:r169 @human
  场景: tool-schemas-remain-compatible
    - 必须成立：当 前端基于 `renderDescriptor`/`configSchema` 渲染工具输出；那么 字段语义 SHALL 保持稳定以避免客户端漂移
    当 前端基于 `renderDescriptor`/`configSchema` 渲染工具输出
    那么 字段语义 SHALL 保持稳定以避免客户端漂移

  @req:r202 @human
  场景: renderer-selection-follows-priority
    - 必须成立：当 某输出类型同时存在 `frontendBundle` 与 `renderDescriptor`；那么 系统 SHALL 优先选择 `frontendBundle` 对应的专用渲染器
    当 某输出类型同时存在 `frontendBundle` 与 `renderDescriptor`
    那么 系统 SHALL 优先选择 `frontendBundle` 对应的专用渲染器

  @req:r202 @human
  场景: unsupported-or-broken-bundle-falls-back-safely
    - 必须成立：当 `frontendBundle` 的 `apiVersion` 不受支持，或 bundle 加载/导出解析失败；那么 系统 SHALL 回退到 `renderDescriptor` 驱动的通用渲染器（若存在）
    当 `frontendBundle` 的 `apiVersion` 不受支持，或 bundle 加载/导出解析失败
    那么 系统 SHALL 回退到 `renderDescriptor` 驱动的通用渲染器（若存在）

  @req:outputs-response-contract @human
  场景: post-returns-output-read
    - 必须成立：假如 客户端 POST 创建 output；当 请求成功；那么 系统 SHALL 返回 camelCase OutputRead（含 id/notebookId/createdAt 等字段）
    假如 客户端 POST 创建 output
    当 请求成功
    那么 系统 SHALL 返回 camelCase OutputRead（含 id/notebookId/createdAt 等字段）

  @req:outputs-export-fields @human
  场景: json-export-citations
    - 必须成立：假如 客户端请求 format=json 导出；当 导出构建；那么 citations SHALL 含 chunkIndex/pageNumber/paragraphIndex/score 且 sources 用 sourceId/sourceName/mimeType/parserType
    假如 客户端请求 format=json 导出
    当 导出构建
    那么 citations SHALL 含 chunkIndex/pageNumber/paragraphIndex/score 且 sources 用 sourceId/sourceName/mimeType/parserType

  @req:outputs-error-mapping @human
  场景: model-unavailable
    - 必须成立：假如 配置的 model 不可用；当 生成阶段；那么 系统 SHALL 返回 503 而非 500
    假如 配置的 model 不可用
    当 生成阶段
    那么 系统 SHALL 返回 503 而非 500

  @req:outputs-slides-must-be-rejected-at-outputs-endpoint @human
  场景: slides-rejected
    - 必须成立：假如 客户端 POST /outputs type=SLIDES；当 系统处理请求；那么 SHALL 返回 400 并提示用 studio slides 端点
    假如 客户端 POST /outputs type=SLIDES
    当 系统处理请求
    那么 SHALL 返回 400 并提示用 studio slides 端点

  @req:outputs-export-format @human
  场景: markdown-export
    - 必须成立：假如 一个 FAQ 类型 output 存在；当 客户端请求 format=markdown；那么 系统 SHALL 返回按 FAQ 格式渲染的 markdown 文本
    假如 一个 FAQ 类型 output 存在
    当 客户端请求 format=markdown
    那么 系统 SHALL 返回按 FAQ 格式渲染的 markdown 文本

  @req:outputs-convert-type-aware @human
  场景: convert-timeline
    - 必须成立：假如 一个 TIMELINE 类型 output 转换为 source；当 convert-to-source 调用；那么 系统 SHALL 先渲染为 timeline markdown 再分块嵌入
    假如 一个 TIMELINE 类型 output 转换为 source
    当 convert-to-source 调用
    那么 系统 SHALL 先渲染为 timeline markdown 再分块嵌入
