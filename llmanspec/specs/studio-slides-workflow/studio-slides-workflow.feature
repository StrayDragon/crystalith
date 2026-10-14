# language: zh-CN
# capability: studio-slides-workflow
# purpose: 定义 SLIDES 的端到端工作流：draft 单一事实源、outline/markdown SSE、保存同步与预览链路。该规范用于保证断线重连、重试与预览刷新时的状态一致性。

功能: studio-slides-workflow

  @req:r307
  规则: Slides are draft-centric across three stages
    slides MUST 围绕 draft 运行 input/outline/markdown 三阶段并可恢复（任一阶段中断后返回时 SHALL 能恢复到最近保存的阶段状态）。

    场景: draft-progresses-three-stages
      当 依次调用创建 draft、outline 生成与 markdown 生成端点
      那么 draft 依次进入 input、outline、markdown 阶段
      而且 每阶段结果已持久化，中断后返回可恢复到最近保存的阶段状态
  @req:r308
  规则: Draft API contract is stable
    draft CRUD、outline 保存、markdown 保存端点 MUST 保持稳定；当 slides workflow capability 不可用（未安装/未启用/未选定 active slides workflow plugin）时，这些端点 MUST 返回稳定且可执行的 unavailable 诊断（稳定 errorCode/message/hint/details），而不是假设 slides 默认可用。

    场景: draft-api-contract-stable
      假如 slides workflow capability 可用
      当 按 BDD 幻灯片工作室场景调用 draft CRUD 与 outline/markdown 保存端点
      那么 创建、获取、更新草稿、更新大纲、更新 Markdown 与 404 场景均按稳定合约通过
  @req:r309
  规则: SSE endpoints and events are stable
    outline/markdown stream MUST 通过 SSE 端点流式返回，使用稳定事件集合 `progress/toolcall/done/busy/error`；MUST NOT 返回同步 JSON。

    场景: sse-endpoints-and-events-stable
      当 consumeSlidesStageStream 请求 outline/markdown 的 GET stream 端点
      那么 以 text/event-stream 返回，事件集合限于 progress/toolcall/done/busy/error
      而且 done 事件使流 resolve、error 事件携带可读消息结束连接，不返回同步 JSON
  @req:r310
  规则: Busy and stale-running handling is explicit
    draft `running` 时 MUST 防并发重复（返回 busy 事件而非覆盖）；stale running（超过阈值；默认值来自 config schema）MUST 先清理再继续；清理 MUST 将 status 置为 IDLE、清空 errorMessage（置 null）并返回 bool，MUST NOT 写入非空诊断文案。
  
    场景: busy-guard-and-stale-cleanup
      假如 studio 集成环境就绪且某 slide 处于非 stale 的 running 状态（tests/studio/deferred-lock.test.ts）
      当 再次发起该 slide 的生成流
      那么 返回 busy SSE 事件（携带 traceId/slideId）而非开启第二个流
      而且 对超过阈值的 stale running 执行清理时
      那么 status 置为 idle、errorMessage 清空（null）、清理返回 true

@req:r311
  规则: Markdown generation requires existing outline
    未有 outline 时 markdown stream MUST 返回可读错误并结束连接。

    场景: markdown-requires-existing-outline
      当 对仍无 outline（input 阶段）的 draft 请求 markdown 生成
      那么 返回可读错误（404）并结束连接，不进入 markdown 生成
  @req:r312
  规则: Successful generation persists draft before done
    生成成功 MUST 先持久化 draft（含 chunkIds/stage/status），再发 `done`。

    场景: persist-draft-before-done
      当 outline 或 markdown 生成成功完成
      那么 draft 的 stage/status 与生成内容（含 chunkIds）先落库
      而且 落库完成后才发出 done 事件
  @req:r313
  规则: Preview always uses latest saved markdown
    预览前端流程 MUST 先保存 markdown，再刷新当前 active slides workflow plugin 声明的预览目标；宿主与客户端 MUST NOT 硬编码 Slidev 作为唯一预览实现。
  
    场景: preview-saves-then-refreshes-via-plugin-target
      假如 SlidesStudio 打开且预览能力就绪（useSlidesPreviewSync.test）
      当 点击预览
      那么 先执行 markdown 保存再刷新预览目标
      而且 预览目标由当前 slides 插件声明的 preview descriptor 解析、未声明时明确报错且不触发保存

@req:r314
  规则: Slides UI availability follows tools contract
    Studio slides 相关 UI（工具卡片、dialog、入口动作）MUST 以 `/v2/workspace/tools` 返回的 `SLIDES` tool 作为可用性唯一来源，不得依赖硬编码假设 slides 默认存在。

    场景: slides-ui-follows-tools-contract
      当 Studio 工具网格按 /v2/workspace/tools 返回的工具列表做可渲染判定
      那么 SLIDES 卡片仅在 SLIDES tool enabled 时出现
      而且 非 SLIDES 工具的渲染不依赖 slides 默认存在的假设
  @req:r315
  规则: Studio MUST provide drafts/latest endpoint
    studio MUST 提供 GET 端点返回 notebook 下按 updatedAt desc 的最新 draft，MUST NOT 缺失该端点

    场景: latest-draft-endpoint
      当 notebook 下存在多个 draft 时调用 GET /v2/notebooks/:nid/studio/slides/latest
      那么 返回按 updatedAt 降序排列的最新 draft
  @req:r316
  规则: Studio slide serialization MUST include outputId and generationConfig
    studio slide 序列化结果 MUST 返回 outputId（可为 null）与 generationConfig 字段（camelCase wire）；前端读 outputId 做 slide→output 跳转、读 generationConfig 复用配置
  
    场景: slide-serialization-carries-output-and-config
      假如 studio 集成环境就绪（tests/studio/deferred-lock.test.ts）
      当 读取 slide 详情
      那么 序列化结果包含 camelCase 的 outputId（可为 null）与 generationConfig 字段

@req:r317
  规则: Studio SSE done event MUST carry traceId and slideId (not full slide)
    studio SSE 的 done 事件 payload MUST 为 {traceId, slideId}（camelCase），MUST NOT 直接序列化整个 slide；且所有 SSE 事件 SHALL 携带 traceId 以支持关联/可观测性；outline/markdown 各生成阶段前 SHALL 发 toolcall 事件（对齐既有语义）
  
    场景: done-payload-is-traceid-and-slideid
      假如 studio 集成环境就绪（tests/studio/deferred-lock.test.ts）
      当 生成流发出 done 事件
      那么 payload 键集恰为 {traceId, slideId} 且不含 markdown/generationConfig 等全量 slide 字段

@req:r318
  规则: Studio generation MUST interpret generationConfig with concrete ranges not raw tokens
    studio outline 与 markdown 生成 MUST 解读 slide.generationConfig 的 quantity/density/audience/tone/structure/language/themePreset 字段并展开为具体区间与本地化提示；quantity/density 的区间映射 MUST 可配置（默认对齐既有语义）；preference（quality/speed）对检索参数（topK/minScore）的调节见 generation-core r162/r163（canonical）。MUST NOT 把原始字段 id（如 'standard'）直接拼进 prompt 而不做展开。

    场景: generationconfig-expanded-to-ranges
      当 resolveQuantityRange 与 resolveBulletRange 解读 generationConfig 的 quantity/density
      那么 展开为具体区间（如 detailed 对应 12-18 张、dense 对应 5-7 个要点），未知值回退 standard 区间
      而且 buildConfigHints 产出含具体区间与本地化提示的中文文案且不携带原始 token
  @req:r319
  规则: Studio frontmatter MUST use the six-key template shape with override support
    studio 生成的 markdown frontmatter MUST 为 6-key 结构（theme 恒为 default、colorSchema、fonts{sans,serif,mono}、transition、background、class），对齐既有模板语义；当 generationConfig.frontmatter 非空时，MUST 以该字符串作为 frontmatter body 绕过预设，仅在缺 title: 且存在标题时补一行。预设路径（generationConfig.frontmatter 为空）MUST NOT 省略 colorSchema/class/serif/mono 字段；override 模式以用户提供的字符串为准，不适用该补全约束。

    场景: frontmatter-six-key-and-override
      当 buildFrontmatter 走预设路径生成 frontmatter
      那么 输出 6-key 结构（theme 恒为 default、colorSchema、fonts{sans,serif,mono}、transition、background、class）并以 --- 围栏包裹
      而且 override 字符串非空时逐字采用（剥离围栏、仅在缺 title 且有标题时补一行），为空白时回退预设
  @req:r320
  规则: SLIDES availability is determined by config and probe, not hardcoded
    server MUST 依据「active slides workflow 插件已加载 ∧ 预览进程探测可达」判定 SLIDES 可用性；探测目标与超时 MUST 经 config schema（slides_preview.base_url / probe_timeout_ms，env 覆盖 CL_SLIDEV_BASE_URL）声明，探测结果 MUST 短 TTL 缓存且失败 MUST 降级为结构化诊断而非异常。`/v2/workspace/tools` MUST 将结果填入 `diagnostics.slides`（available/message/hint/activePluginId/engine/errorCode），SLIDES tool 的 `enabled` MUST 反映该可用性；MUST NOT 硬编码 enabled=true。不可用时 errorCode MUST 取稳定值（SLIDES_PREVIEW_UNREACHABLE / SLIDES_PLUGIN_MISSING / SLIDES_PREVIEW_DISABLED）且 hint MUST 可执行。

    场景: slides-availability-via-probe
      当 buildSlidesDiagnostic 按 config 声明的 base_url 与超时探测预览进程
      那么 可达时 diagnostics.slides.available 为 true 且 SLIDES tool enabled
      而且 不可达时降级为结构化诊断（稳定 errorCode 与可执行 hint）并置 SLIDES tool enabled 为 false
  @req:r321
  规则: Studio generate entry removes SLIDES when unavailable
    当 `/v2/workspace/tools` 的 `diagnostics.slides.available === false` 时，Studio 生成入口（工具弹层）MUST 移除 SLIDES 卡片；不可用原因与恢复提示 MUST 仍可经诊断面板（diagnostics.slides）呈现。MUST NOT 影响其余输出类型工具的渲染。

    场景: studio-entry-drops-slides-when-unavailable
      当 /v2/workspace/tools 返回 diagnostics.slides.available 为 false
      那么 Studio 生成入口（工具弹层）不再渲染 SLIDES 卡片
      而且 其余输出类型工具照常渲染，不可用原因仍可经诊断面板查看
