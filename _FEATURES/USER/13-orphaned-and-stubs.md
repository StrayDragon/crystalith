# 孤儿组件、存根与未使用代码

已实现但未挂载到主工作区路径，或仅为占位/回退的 UI 与数据。

### `output-invalid-type-runtime`

- **名称:** 笔记列表中的 `INVALID_TYPE` 输出条目
- **位置:** Studio 笔记列表（实机截图可见）
- **入口:** 历史脏数据 / 未知 output type 渲染回退
- **操作:** 列表展示；打开可能走 fallback
- **Server:** `outputs` 表 type 字段与生成器枚举不一致时出现
- **代码:** `domains/outputs/OutputContent.tsx`、`StudioOutputsList.tsx`
- **截图:** `screenshots/studio-panel.png`（列表中可见）

> NOTE: 待盘点

---

### `refine-panel-ui`

- **名称:** Refine 面板 UI
- **位置:** （未挂载）
- **入口:** 无生产入口；组件完整实现
- **操作:** 段落/要点/结构化 Refine 生成与预览
- **Server:** `GET /v2/refine/modes`、`POST /v2/refine`、`POST /v2/refine/batch`
- **代码:** `apps/web/src/features/workspace/domains/refine/RefinePanel.tsx`、`useRefine.ts`
- **截图:** `screenshots/refine-panel-ui.png`（待截图）

> NOTE: 待盘点

---

### `analysis-panel-ui`

- **名称:** Analysis 面板 UI
- **位置:** （未挂载；`KnowledgeGraphView` 为活跃入口）
- **入口:** 无
- **操作:** 主题/矛盾/关系表格化展示（旧版分析 UI）
- **Server:** `POST /v2/analysis`
- **代码:** `apps/web/src/features/workspace/domains/analysis/AnalysisPanel.tsx`
- **截图:** `screenshots/analysis-panel-ui.png`（待截图）

> NOTE: 待盘点

---

### `output-type-selector`

- **名称:** Output 类型选择器
- **位置:** （未挂载）
- **入口:** 无
- **操作:** 选择 Output 类型用于生成
- **Server:** `GET /v2/outputs/types`
- **代码:** `apps/web/src/features/workspace/domains/outputs/OutputTypeSelector.tsx`
- **截图:** `screenshots/output-type-selector.png`（待截图）

> NOTE: 待盘点

---

### `audio-overview-stub`

- **名称:** 音频概览选项（存根）
- **位置:** Studio 工具区占位
- **入口:** 渲染占位 UI
- **操作:** 无实际功能
- **Server:** —
- **代码:** `apps/web/src/features/workspace/domains/outputs/AudioOverviewOption.tsx`
- **截图:** `screenshots/audio-overview-stub.png`（待截图）

> NOTE: 待盘点

---

### `video-overview-stub`

- **名称:** 视频概览选项（存根）
- **位置:** Studio 工具区占位
- **入口:** 渲染占位 UI
- **操作:** 无实际功能
- **Server:** —
- **代码:** `apps/web/src/features/workspace/domains/outputs/VideoOverviewOption.tsx`
- **截图:** `screenshots/video-overview-stub.png`（待截图）

> NOTE: 待盘点

---

### `audio-player-orphan`

- **名称:** AudioPlayer 组件
- **位置:** （未挂载）
- **入口:** 无
- **操作:** 音频播放 UI
- **Server:** —
- **代码:** `apps/web/src/features/workspace/domains/outputs/AudioPlayer.tsx`
- **截图:** `screenshots/audio-player-orphan.png`（待截图）

> NOTE: 待盘点

---

### `video-player-orphan`

- **名称:** VideoPlayer 组件
- **位置:** （未挂载）
- **入口:** 无
- **操作:** 视频播放 UI
- **Server:** —
- **代码:** `apps/web/src/features/workspace/domains/outputs/VideoPlayer.tsx`
- **截图:** `screenshots/video-player-orphan.png`（待截图）

> NOTE: 待盘点

---

### `answer-card-orphan`

- **名称:** AnswerCard（消息嵌入式卡片）
- **位置:** 消息渲染路径（stats preset 等场景可能使用）
- **入口:** QA 返回结构化 JSON 时
- **操作:** 展示答案卡片
- **Server:** `POST /v2/qa`（stats preset）
- **代码:** `apps/web/src/features/workspace/domains/messages/components/AnswerCard.tsx`
- **截图:** `screenshots/answer-card-orphan.png`（待截图）

> NOTE: 待盘点

---

### `barchart-card-orphan`

- **名称:** BarChartCard
- **位置:** 消息 stats 预设渲染
- **入口:** stats preset JSON chart 字段
- **操作:** 简易柱状图展示
- **Server:** `POST /v2/qa`（stats preset）
- **代码:** `apps/web/src/features/workspace/domains/messages/components/BarChartCard.tsx`
- **截图:** `screenshots/barchart-card-orphan.png`（待截图）

> NOTE: 待盘点

---

### `datatable-card-orphan`

- **名称:** DataTableCard
- **位置:** 消息 stats 预设渲染
- **入口:** stats preset table 字段
- **操作:** 表格数据展示
- **Server:** `POST /v2/qa`
- **代码:** `apps/web/src/features/workspace/domains/messages/components/DataTableCard.tsx`
- **截图:** `screenshots/datatable-card-orphan.png`（待截图）

> NOTE: 待盘点

---

### `tool-action-card-orphan`

- **名称:** ToolActionCard
- **位置:** 消息工具调用展示
- **入口:** AI tool loop 消息（若启用）
- **操作:** 展示 tool name / 参数
- **Server:** `POST /v2/qa/stream`
- **代码:** `apps/web/src/features/workspace/domains/messages/components/ToolActionCard.tsx`
- **截图:** `screenshots/tool-action-card-orphan.png`（待截图）

> NOTE: 待盘点

---

### `json-fallback-card-orphan`

- **名称:** JsonFallbackCard
- **位置:** 消息无法解析时的回退
- **入口:** 未知消息 JSON 结构
- **操作:** 原始 JSON 展示
- **Server:** —
- **代码:** `apps/web/src/features/workspace/domains/messages/components/JsonFallbackCard.tsx`
- **截图:** `screenshots/json-fallback-card-orphan.png`（待截图）

> NOTE: 待盘点

---

### `use-tasks-hook-unused`

- **名称:** useTasks Hook（未使用）
- **位置:** 代码存在，无组件 import
- **入口:** 无
- **操作:** 轮询 `/v2/notebooks/:nid/tasks`（与 `useOutputQueue` 功能重叠）
- **Server:** `GET /v2/notebooks/:nid/tasks`、`GET /v2/tasks/:id`
- **代码:** `apps/web/src/features/workspace/shared/hooks/useTasks.ts`
- **截图:** —（无 UI）

> NOTE: 待盘点

---

### `refine-templates-data`

- **名称:** Refine 模板静态数据
- **位置:** RefinePanel 内引用
- **入口:** 随 RefinePanel（未挂载）
- **操作:** 预设 prompt 模板列表
- **Server:** —
- **代码:** `apps/web/src/features/workspace/domains/refine/data/refineTemplates.ts`
- **截图:** —（无独立 UI）

> NOTE: 待盘点

---

### `dev-payload-warnings`

- **名称:** DEV 环境 Payload 警告
- **位置:** OutputContent 开发模式横幅
- **入口:** `import.meta.env.DEV` 且 bundle/解析有 warnings
- **操作:** console.warn + UI 警告条
- **Server:** —
- **代码:** `apps/web/src/features/workspace/domains/outputs/OutputContent.tsx`
- **截图:** `screenshots/dev-payload-warnings.png`（待截图）

> NOTE: 待盘点
