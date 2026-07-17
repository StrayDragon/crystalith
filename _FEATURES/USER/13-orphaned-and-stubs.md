# 孤儿组件、存根与未使用代码

## 已移除（2026-07-17）

以下孤儿前端存根已删除（代码与 `_FEATURES` 对应条目同步移除）：

| Feature ID                  | 删除文件                                           |
| --------------------------- | -------------------------------------------------- |
| `refine-panel-ui`           | `domains/refine/RefinePanel.tsx`                   |
| `output-type-selector`      | `domains/outputs/OutputTypeSelector.tsx`           |
| `audio-overview-stub`       | `domains/outputs/AudioOverviewOption.tsx`          |
| `video-overview-stub`       | `domains/outputs/VideoOverviewOption.tsx`          |
| `audio-player-orphan`       | `domains/outputs/AudioPlayer.tsx`                  |
| `video-player-orphan`       | `domains/outputs/VideoPlayer.tsx`                  |
| `answer-card-orphan`        | `domains/messages/components/AnswerCard.tsx`       |
| `barchart-card-orphan`      | `domains/messages/components/BarChartCard.tsx`     |
| `datatable-card-orphan`     | `domains/messages/components/DataTableCard.tsx`    |
| `tool-action-card-orphan`   | `domains/messages/components/ToolActionCard.tsx`   |
| `json-fallback-card-orphan` | `domains/messages/components/JsonFallbackCard.tsx` |
| `use-tasks-hook-unused`     | `shared/hooks/useTasks.ts`                         |

**仍保留（未删）：** `useRefine.ts`（Studio 活动 hook，命名遗留）、Server `/v2/refine*` API、`refineTemplates.ts`（见下条，仅 dead refine-job 路径引用，待后续 prune）。

---

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

### `refine-templates-data`

- **名称:** refineTemplates 数据（已删除）
- **状态:** 2026-07-17 随 `useRefine` 死路径 prune 一并删除；Studio 笔记类型经 `POST /v2/outputs`

> NOTE: 已删除

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
