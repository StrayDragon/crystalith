# 输出（Outputs）

Output 查看、渲染、导出、删除、转换与任务队列。

---

### `studio-output-viewer`

- **名称:** Studio Output 查看器
- **位置:** Studio 面板主内容区
- **入口:** 从列表选择 Output
- **操作:** 展示标题、类型、内容区、操作栏
- **Server:** `GET /v2/outputs/:id`
- **代码:** `apps/web/src/features/workspace/domains/outputs/StudioOutputViewer.tsx`
- **截图:** `screenshots/studio-output-viewer.png`（待截图）

> NOTE: 待盘点

---

### `output-content-renderer`

- **名称:** Output 内容渲染器
- **位置:** Output 查看器内部
- **入口:** 加载 Output 内容后
- **操作:** 按类型分发到插件或 GenericOutputRenderer
- **Server:** —
- **代码:** `apps/web/src/features/workspace/domains/outputs/OutputContent.tsx`
- **截图:** `screenshots/output-content-renderer.png`（待截图）

> NOTE: 待盘点

---

### `output-export`

- **名称:** Output 导出
- **位置:** Output 查看器 / 命令面板
- **入口:** 导出 Markdown / JSON
- **操作:** 下载含引用的导出文件
- **Server:** `GET /v2/outputs/:id/export`
- **代码:** `apps/web/src/features/workspace/domains/outputs/useExport.ts`、`shared/evidenceExport.ts`
- **截图:** `screenshots/output-export.png`（待截图）

> NOTE: 待盘点

---

### `output-delete`

- **名称:** 删除 Output
- **位置:** Output 列表项 / 查看器操作
- **入口:** 删除按钮
- **操作:** 确认后删除
- **Server:** `DELETE /v2/outputs/:id`
- **代码:** `apps/web/src/features/workspace/domains/studio/StudioOutputsList.tsx`
- **截图:** `screenshots/output-delete.png`（待截图）

> NOTE: 待盘点

---

### `output-convert-to-source`

- **名称:** Output 转为来源
- **位置:** Output 操作菜单
- **入口:** 「转为来源」
- **操作:** 将 Output 内容 chunk + embed 为新 source
- **Server:** `POST /v2/outputs/:id/convert-to-source`
- **代码:** `apps/web/src/features/workspace/domains/outputs/StudioOutputViewer.tsx`
- **截图:** `screenshots/output-convert-to-source.png`（待截图）

> NOTE: 待盘点

---

### `output-queue-jobs`

- **名称:** Output 生成任务队列
- **位置:** Studio / 全局任务状态
- **入口:** 触发生成后
- **操作:** 客户端本地队列（queued/running/error）串行跑 `POST .../outputs` 或 slides SSE；失败可重试
- **Server:** `POST /v2/notebooks/:nid/outputs`、studio slides stream（**不**使用 `/v2/tasks*`）
- **代码:** `apps/web/src/features/workspace/shared/hooks/useOutputQueue.ts`
- **截图:** `screenshots/output-queue-jobs.png`（待截图）

> NOTE: 2026-07-20 以代码为准 — 客户端本地队列；`/v2/tasks*` 已于 c73 移除。

---

### `output-fallback-retry`

- **名称:** Output 降级重试提示
- **位置:** 结构化 Output 内容区顶部
- **入口:** `is_fallback` 或生成失败降级时
- **操作:** 展示警告与重试建议
- **Server:** `POST /v2/outputs`（重试）
- **代码:** `apps/web/src/features/workspace/domains/outputs/plugins/allPlugins.tsx`（`FallbackWarning`）、`GenericOutputRenderer.tsx`
- **截图:** `screenshots/output-fallback-retry.png`（待截图）

> NOTE: 待盘点

---

### `generic-output-renderer`

- **名称:** 通用 Output 渲染器
- **位置:** 无专用插件时的回退渲染
- **入口:** `render_descriptor` 或未知类型
- **操作:** JSON/文本/简单结构展示
- **Server:** `GET /v2/workspace/tools`（~~`/outputs/types`~~ c73 已删）
- **代码:** `apps/web/src/features/workspace/domains/outputs/GenericOutputRenderer.tsx`
- **截图:** `screenshots/generic-output-renderer.png`（待截图）

> NOTE: 2026-07-20 — 不以 `/outputs/types` 为依赖

---

### `output-note-type-paragraph`

- **名称:** 笔记类型 — 段落（PARAGRAPH）
- **位置:** Studio 手动笔记 / 生成工具
- **入口:** 创建 paragraph 类型 Output
- **操作:** 富文本/段落编辑与展示
- **Server:** `POST /v2/notebooks/:nid/outputs`（~~`/v2/refine`~~ c73 已删）
- **代码:** `apps/web/src/features/workspace/domains/outputs/StudioPrimitives.tsx`
- **截图:** `screenshots/output-note-type-paragraph.png`（待截图）

> NOTE: 2026-07-20 — 仅 outputs 路径

---

### `output-note-type-bullets`

- **名称:** 笔记类型 — 要点（BULLETS）
- **位置:** Studio / 会话转 Output
- **入口:** bullets 格式生成
- **操作:** 列表要点展示与编辑
- **Server:** `POST /v2/notebooks/:nid/outputs`（~~`/v2/refine`~~ c73 已删）
- **代码:** `apps/web/src/features/workspace/domains/outputs/StudioPrimitives.tsx`
- **截图:** `screenshots/output-note-type-bullets.png`（待截图）

> NOTE: 2026-07-20 — 仅 outputs 路径

---

### `output-note-type-structured`

- **名称:** 笔记类型 — 结构化（STRUCTURED）
- **位置:** Studio
- **入口:** structured 格式
- **操作:** 结构化字段块展示
- **Server:** `POST /v2/notebooks/:nid/outputs`（~~`/v2/refine`~~ c73 已删）
- **代码:** `apps/web/src/features/workspace/domains/outputs/StudioPrimitives.tsx`
- **截图:** `screenshots/output-note-type-structured.png`（待截图）

> NOTE: 2026-07-20 — 仅 outputs 路径
