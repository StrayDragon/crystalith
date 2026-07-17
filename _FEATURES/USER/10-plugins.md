# Output 插件（Plugins）

结构化 Output 类型的专用交互渲染器与官方 Bundle。

---

### `output-faq-flashcards`

- **名称:** FAQ / 闪卡插件
- **位置:** Output 查看器（类型 FAQ）
- **入口:** 生成 FAQ 类型 Output
- **操作:** 卡片翻转、逐条浏览问答
- **Server:** `POST /v2/outputs`（type=FAQ）
- **代码:** `apps/web/src/features/workspace/domains/outputs/plugins/allPlugins.tsx`（`faqPlugin`）、`FlashcardViewer.tsx`
- **截图:** `screenshots/output-faq-flashcards.png`（待截图）

> NOTE: 待盘点

---

### `output-guide-checklist`

- **名称:** 指南清单插件
- **位置:** Output 查看器（类型 GUIDE）
- **入口:** 生成 GUIDE 类型 Output
- **操作:** 模块/步骤 checklist 交互
- **Server:** `POST /v2/outputs`（type=GUIDE）
- **代码:** `apps/web/src/features/workspace/domains/outputs/plugins/allPlugins.tsx`（`guidePlugin`）、`GuideChecklist.tsx`
- **截图:** `screenshots/output-guide-checklist.png`（待截图）

> NOTE: 待盘点

---

### `output-timeline`

- **名称:** 时间轴插件
- **位置:** Output 查看器（类型 TIMELINE）
- **入口:** 生成 TIMELINE 类型 Output
- **操作:** 事件序列时间轴展示
- **Server:** `POST /v2/outputs`（type=TIMELINE）
- **代码:** `apps/web/src/features/workspace/domains/outputs/plugins/allPlugins.tsx`（`timelinePlugin`）、`TimelineViewer.tsx`
- **截图:** `screenshots/output-timeline.png`（待截图）

> NOTE: 待盘点

---

### `output-mindmap`

- **名称:** 思维导图插件
- **位置:** Output 查看器（类型 MINDMAP）
- **入口:** 生成 MINDMAP 类型 Output
- **操作:** 可交互树形思维导图
- **Server:** `POST /v2/outputs`（type=MINDMAP）
- **代码:** `apps/web/src/features/workspace/domains/outputs/plugins/allPlugins.tsx`（`mindmapPlugin`）、`MindmapViewer.tsx`
- **截图:** `screenshots/output-mindmap.png`（待截图）

> NOTE: 待盘点

---

### `output-quiz`

- **名称:** 测验插件
- **位置:** Output 查看器（类型 QUIZ）
- **入口:** 生成 QUIZ 类型 Output
- **操作:** 答题、判分、解析
- **Server:** `POST /v2/outputs`（type=QUIZ）
- **代码:** `apps/web/src/features/workspace/domains/outputs/plugins/allPlugins.tsx`（`quizPlugin`）、`QuizRunner.tsx`
- **截图:** `screenshots/output-quiz.png`（待截图）

> NOTE: 待盘点

---

### `output-briefing-report`

- **名称:** 简报报告插件
- **位置:** Output 查看器（类型 BRIEFING）
- **入口:** 生成 BRIEFING 类型 Output
- **操作:** 分段报告（背景/发现/建议）展示
- **Server:** `POST /v2/outputs`（type=BRIEFING）
- **代码:** `apps/web/src/features/workspace/domains/outputs/plugins/allPlugins.tsx`（`briefingPlugin`）、`ReportViewer.tsx`
- **截图:** `screenshots/output-briefing-report.png`（待截图）

> NOTE: 待盘点

---

### `output-slides-inline`

- **名称:** 演示文稿内联预览
- **位置:** Output 查看器（类型 SLIDES）
- **入口:** 生成 SLIDES 类型 Output
- **操作:** 展示大纲、Slidev Markdown 预览；可跳转 Slides Studio
- **Server:** `POST /v2/outputs`（type=SLIDES）、`GET /v2/studio/slides/*`
- **代码:** `apps/web/src/features/workspace/domains/outputs/plugins/allPlugins.tsx`（`slidesPlugin`）
- **截图:** `screenshots/output-slides-inline.png`（待截图）

> NOTE: 待盘点

---

### `output-official-bundles`

- **名称:** 官方 Frontend Bundle 加载
- **位置:** `OutputContent` 动态 import 路径
- **入口:** `workspace/tools` 返回 `frontend_bundle` 描述符时
- **操作:** 按 bundle id 懒加载 `apps/web/src/plugins/official/*` 渲染函数
- **Server:** `GET /v2/workspace/tools`（`frontend_bundle` 元数据）
- **代码:** `apps/web/src/plugins/official/registry.ts`、`domains/outputs/OutputContent.tsx`
- **截图:** `screenshots/output-official-bundles.png`（待截图）

**已注册 Bundle ID：** `output-faq`、`output-guide`、`output-timeline`、`output-mindmap`、`output-quiz`、`output-briefing`、`output-slides`

> NOTE: 待盘点
