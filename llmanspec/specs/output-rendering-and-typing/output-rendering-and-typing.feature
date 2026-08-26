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

  @req:r202 @human
  场景: unsupported-or-broken-bundle-falls-back-safely
    - 当 `frontendBundle` 的 `apiVersion` 不受支持或 bundle 加载/导出解析失败时，系统 MUST 回退到 `renderDescriptor` 驱动的通用渲染器（若存在），并以 Raw JSON 作为最终安全回退。

  @req:outputs-response-contract @human
  场景: POST outputs MUST return OutputRead contract
    - POST /v2/notebooks/:nid/outputs MUST 返回 camelCase OutputRead 实体（id/notebookId/type/prompt/chunkIds/content/createdAt/updatedAt），与 packages/shared Zod wire 契约一致；MUST NOT 返回 snake_case 或裸 PipelineResult；扁平 /v2/outputs 的登记禁令见 openapi openapi-documents-nested-canonical-paths（canonical）

  @req:outputs-export-fields @human
  场景: Export JSON citations and sources MUST match camelCase wire
    - GET /outputs/:id/export?format=json 的 citations MUST 包含 chunkIndex/pageNumber/paragraphIndex/score；sources meta 字段集见 workspace-api-contract qa-export-endpoint（canonical）

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
