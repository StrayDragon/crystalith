# 深度研究（Research）

Deep Research 启动、进度胶囊、详情与历史。

---

### `deep-research-start`

- **名称:** 启动深度研究
- **位置:** 来源面板搜索区 / 研究入口
- **入口:** 输入主题后「深度研究」
- **操作:** 创建 research session，进入 HITL 流程
- **Server:** `POST /v2/research`
- **代码:** `apps/web/src/features/workspace/domains/sources/components/SourcesPanelView.tsx`、`domains/research/useResearch.ts`
- **截图:** `screenshots/deep-research-start.png`（待截图）

> NOTE: 待盘点

---

### `research-capsule`

- **名称:** 研究进度胶囊
- **位置:** 来源面板顶部浮动条
- **入口:** 存在进行中的 research session
- **操作:** 显示状态、点击进入详情、取消/恢复
- **Server:** `GET /v2/research`、`POST /v2/research/:id/cancel`、`POST /v2/research/:id/resume`
- **代码:** `apps/web/src/features/workspace/domains/research/ResearchCapsule.tsx`
- **截图:** `screenshots/research-capsule.png`（待截图）

> NOTE: 待盘点

---

### `research-detail-panel`

- **名称:** 研究详情面板
- **位置:** 全屏/侧滑详情 Overlay
- **入口:** 点击胶囊或历史项
- **操作:** HITL 审批（approve/modify/skip）、查看流式进度、完成、导出、添加来源
- **Server:** `GET /v2/research/:id`、`POST .../approve|modify|skip|finish`、`GET .../stream`、`POST .../export`
- **代码:** `apps/web/src/features/workspace/domains/research/ResearchDetailPanel.tsx`、`ResearchExportDialog.tsx`
- **截图:** `screenshots/research-detail-panel.png`（待截图）

> NOTE: 待盘点

---

### `research-history`

- **名称:** 研究历史列表
- **位置:** 研究详情或来源面板历史区
- **入口:** 查看已完成/已取消的研究
- **操作:** 列表浏览、删除、重新打开
- **Server:** `GET /v2/research`、`DELETE /v2/research/:id`
- **代码:** `apps/web/src/features/workspace/domains/research/useResearch.ts`、`ResearchDetailPanel.tsx`
- **截图:** `screenshots/research-history.png`（待截图）

> NOTE: 待盘点
