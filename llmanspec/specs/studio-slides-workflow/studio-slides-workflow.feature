# language: zh-CN
# capability: studio-slides-workflow
# purpose: 定义 SLIDES 的端到端工作流：draft 单一事实源、outline/markdown SSE、保存同步与预览链路。该规范用于保证断线重连、重试与预览刷新时的状态一致性。
# scope: src/, tests/

功能: studio-slides-workflow

  @req:r53 @human
  场景: Slides are draft-centric across three stages
    - slides MUST 围绕 draft 运行 input/outline/markdown 三阶段并可恢复（任一阶段中断后返回时 SHALL 能恢复到最近保存的阶段状态）。

  @req:r111 @human
  场景: Draft API contract is stable
    - draft CRUD、outline 保存、markdown 保存端点 MUST 保持稳定；当 slides workflow capability 不可用（未安装/未启用/未选定 active slides workflow plugin）时，这些端点 MUST 返回稳定且可执行的 unavailable 诊断（稳定 errorCode/message/hint/details），而不是假设 slides 默认可用。

  @req:r148 @human
  场景: SSE endpoints and events are stable
    - outline/markdown stream MUST 通过 SSE 端点流式返回，使用稳定事件集合 `progress/toolcall/done/busy/error`；MUST NOT 返回同步 JSON。

  @req:r183 @human
  场景: Busy and stale-running handling is explicit
    - draft `running` 时 MUST 防并发重复（返回 busy 事件而非覆盖）；stale running（超过阈值，默认 10min，可配置）MUST 先清理再继续；清理 MUST 将 status 置为 IDLE、清空 errorMessage（置 null）并返回 bool，MUST NOT 写入非空诊断文案。

  @req:r215 @human
  场景: Markdown generation requires existing outline
    - 未有 outline 时 markdown stream MUST 返回可读错误并结束连接。

  @req:r242 @human
  场景: Successful generation persists draft before done
    - 生成成功 MUST 先持久化 draft（含 chunkIds/stage/status），再发 `done`。

  @req:r9 @human
  场景: Preview always uses latest saved markdown
    - 预览前端流程 MUST 先保存 markdown，再刷新当前 active slides workflow plugin 声明的预览目标；宿主与客户端 MUST NOT 硬编码 Slidev 作为唯一预览实现。

  @req:r272 @human
  场景: Slides UI availability follows tools contract
    - Studio slides 相关 UI（工具卡片、dialog、入口动作）MUST 以 `/v2/workspace/tools` 返回的 `SLIDES` tool 作为可用性唯一来源，不得依赖硬编码假设 slides 默认存在。

  @req:studio-latest-draft @human
  场景: Studio MUST provide drafts/latest endpoint
    - studio MUST 提供 GET 端点返回 notebook 下按 updatedAt desc 的最新 draft，MUST NOT 缺失该端点

  @req:studio-serialize-must-include-output-id-and-config @human
  场景: Studio slide serialization MUST include outputId and generationConfig
    - studio slide 序列化结果 MUST 返回 outputId（可为 null）与 generationConfig 字段（camelCase wire）；前端读 outputId 做 slide→output 跳转、读 generationConfig 复用配置

  @req:studio-sse-done-payload-must-carry-trace-id @human
  场景: Studio SSE done event MUST carry traceId and slideId (not full slide)
    - studio SSE 的 done 事件 payload MUST 为 {traceId, slideId}（camelCase），MUST NOT 直接序列化整个 slide；且所有 SSE 事件 SHALL 携带 traceId 以支持关联/可观测性；outline/markdown 各生成阶段前 SHALL 发 toolcall 事件（对齐既有语义）

  @req:studio-generation-config-must-expand-to-ranges @human
  场景: Studio generation MUST interpret generationConfig with concrete ranges not raw tokens
    - studio outline 与 markdown 生成 MUST 解读 slide.generationConfig 的 quantity/density/audience/tone/structure/language/themePreset 字段并展开为具体区间与本地化提示；quantity/density 的区间映射 MUST 可配置（默认对齐既有语义）；preference（quality/speed）对检索参数（topK/minScore）的调节见 generation-core r126/r162（canonical）。MUST NOT 把原始字段 id（如 'standard'）直接拼进 prompt 而不做展开。

  @req:studio-frontmatter-six-key-shape @human
  场景: Studio frontmatter MUST use the six-key template shape with override support
    - studio 生成的 markdown frontmatter MUST 为 6-key 结构（theme 恒为 default、colorSchema、fonts{sans,serif,mono}、transition、background、class），对齐既有模板语义；当 generationConfig.frontmatter 非空时，MUST 以该字符串作为 frontmatter body 绕过预设，仅在缺 title: 且存在标题时补一行。MUST NOT 省略 colorSchema/class/serif/mono 字段。
