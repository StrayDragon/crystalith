# language: zh-CN
# capability: studio-output-types
# purpose: 定义非 slides 的 Studio 输出类型交互基线（briefing/guide/flashcard/mindmap/quiz/timeline）。该规范以"最小可用交互"约束各类型的前端呈现，保证输出可浏览、可操作与可导出。

功能: studio-output-types

  @req:r299
  规则: Briefing supports section structure and fold
    briefing 输出 MUST 支持章节目录导航与章节折叠/展开。

    场景: briefing-toc-navigation-and-fold
      假如 briefing 输出渲染 ReportViewer 的章节目录与可折叠章节
      当 运行 ReportViewer.test.tsx 的目录与折叠用例
      那么 点击目录条目滚动定位到对应章节
      而且 章节可折叠/展开且首章节默认展开
  @req:r300
  规则: Guide supports checklist and progress cues
    guide 输出 MUST 支持可勾选学习路径与进度提示（勾选步骤后 SHALL 更新进度并保持交互可用）。

    场景: guide-checklist-progress-cues
      假如 guide 输出渲染 GuideChecklist 的可勾选学习路径
      当 运行 GuideChecklist.test.tsx 勾选/取消模块
      那么 进度提示（已完成 n/N 与百分比）随之更新
      而且 勾选控件保持可用、可反复切换
  @req:r301
  规则: Flashcard supports flip and navigation
    flashcard 输出 MUST 支持翻面交互与上一张/下一张的学习进度导航。

    场景: flashcard-flip-and-navigation
      假如 flashcard 输出渲染 FlashcardViewer 的卡片
      当 运行 FlashcardViewer.test.tsx 的翻面与导航用例
      那么 点击/空格键可翻面且 aria 状态同步切换
      而且 上一张/下一张（含左右键）驱动学习进度指示并在边界处禁用
  @req:r302
  规则: Mindmap supports read-only exploration
    mindmap 输出 MUST 支持只读浏览与节点折叠/展开控制。
  
    场景: mindmap-collapsible-read-only
      假如 渲染含多级子节点的 mindmap 输出（MindmapViewer.test）
      当 点击分支节点折叠再展开
      那么 折叠后子节点隐藏并显示子节点计数、展开后还原
      而且 视图不提供任何编辑入口（只读）

@req:r303
  规则: Quiz supports answering and immediate feedback
    quiz 输出 MUST 支持作答、即时反馈与结果汇总查看。
  
    场景: quiz-answering-feedback-and-summary
      假如 渲染含两道单选题的 quiz 输出（QuizRunner.test）
      当 依次作答并提交
      那么 每题提交后立即显示对/错反馈（错题附正确答案与解析）
      而且 全部完成后显示正确率与答对计数的汇总并支持重做

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

    场景: studio-sync-writes-outputid-fk-and-camelcase-content
      假如 studio 幻灯片经历输出同步（output-sync-fk.test.ts 的首次/重复/legacy 同步）
      当 同步完成并回读 studioSlides 与 outputs 行
      那么 studioSlides.outputId 外键被写入且 join 查询走 outputId
      而且 content 为 camelCase 全量形状 {title, engine, outline, markdown, slideId} 且重复同步复用同一 Output 行
