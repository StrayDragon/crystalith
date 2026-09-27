# language: zh-CN
# capability: studio-output-types
# purpose: 定义非 slides 的 Studio 输出类型交互基线（briefing/guide/flashcard/mindmap/quiz/timeline）。该规范以"最小可用交互"约束各类型的前端呈现，保证输出可浏览、可操作与可导出。
# scope: apps/server/src/features/studio/, packages/crystalith-slidev/

功能: studio-output-types

  @req:r299
  规则: Briefing supports section structure and fold
    briefing 输出 MUST 支持章节目录导航与章节折叠/展开。
  @req:r300
  规则: Guide supports checklist and progress cues
    guide 输出 MUST 支持可勾选学习路径与进度提示（勾选步骤后 SHALL 更新进度并保持交互可用）。
  @req:r301
  规则: Flashcard supports flip and navigation
    flashcard 输出 MUST 支持翻面交互与上一张/下一张的学习进度导航。
  @req:r302
  规则: Mindmap supports read-only exploration
    mindmap 输出 MUST 支持只读浏览与节点折叠/展开控制。
  @req:r303
  规则: Quiz supports answering and immediate feedback
    quiz 输出 MUST 支持作答、即时反馈与结果汇总查看。
  @req:r304
  规则: Timeline supports visual events and detail expansion
    timeline 输出 MUST 支持时间轴事件可视化与事件详情展开，且展开详情后时间轴 SHALL 可继续浏览。

    场景: timeline-events-expand-and-keep-browsing
      假如 Studio 收到 timeline 类型的输出 payload
      当 OutputContent 渲染时间轴事件列表
      那么 事件以时间轴形式可视化呈现
      而且 展开某事件详情后时间轴仍可继续浏览
  @req:r305
  规则: Studio output types are plugin-driven and discoverable with recovery hints
    Studio 的工具输出类型集合（含输出类型选择器可选项）MUST 由 `/v2/workspace/tools` 返回的动态列表驱动；客户端 MUST NOT 依赖硬编码枚举来假设某输出类型必然存在（除 `SLIDES` 暂保留 core 内置外，其余工具输出类型 MUST 由官方插件提供）。当某输出类型不可用（插件缺失/禁用/加载失败）时，客户端 MUST 能呈现该能力不可用原因与可执行的恢复提示（例如安装/启用对应官方插件），避免“功能消失但原因不明”。

    场景: output-types-driven-by-tools-list
      假如 客户端准备渲染输出类型选择器
      当 拉取 /v2/workspace/tools 返回的动态工具列表
      那么 选择器可选项由该列表驱动而非硬编码枚举
      而且 类型不可用时呈现原因与安装/启用对应官方插件的恢复提示
  @req:r306
  规则: Studio output sync MUST write studioSlides.outputId FK and full content schema
    studio 的输出同步 MUST (1) 写 studioSlides.outputId 外键，(2) content schema 为 camelCase：content={title, engine, outline, markdown, slideId}。任何依赖 slide→output join 的 UI/查询 MUST 使用 outputId FK
