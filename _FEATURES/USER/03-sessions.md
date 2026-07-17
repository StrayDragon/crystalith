# 会话（Sessions）

对话会话的创建、切换、重命名/删除与详情查看。

---

### `session-switcher`

- **名称:** 会话切换器
- **位置:** 对话面板顶部
- **入口:** 点击当前会话标题
- **操作:** 列表选择会话、创建新会话、搜索切换（命令面板）
- **Server:** `GET /v2/notebooks/:nid/sessions`、`POST /v2/notebooks/:nid/sessions`
- **代码:** `apps/web/src/features/workspace/domains/sessions/SessionSwitcher.tsx`、`useSessions.ts`
- **截图:** `screenshots/session-switcher.png`（待截图）

> NOTE: 待盘点

---

### `session-create`

- **名称:** 新建会话
- **位置:** 会话切换器 / 引导 / 命令面板
- **入口:** 「开始会话」「新建对话」
- **操作:** 创建空会话并设为活动会话
- **Server:** `POST /v2/notebooks/:nid/sessions`
- **代码:** `apps/web/src/features/workspace/domains/sessions/useSessions.ts`、`layout/WorkspaceLayout.tsx`
- **截图:** `screenshots/session-create.png`（待截图）

> NOTE: 待盘点

---

### `session-rename-delete`

- **名称:** 会话重命名与删除
- **位置:** 会话切换器上下文菜单
- **入口:** 会话项操作菜单
- **操作:** 修改标题；删除会话（级联消息）
- **Server:** `PATCH /v2/notebooks/:nid/sessions/:sid`、`DELETE /v2/notebooks/:nid/sessions/:sid`
- **代码:** `apps/web/src/features/workspace/domains/sessions/useSessions.ts`
- **截图:** `screenshots/session-rename-delete.png`（待截图）

> NOTE: 待盘点

---

### `session-detail-dialog`

- **名称:** 会话详情对话框
- **位置:** 模态对话框
- **入口:** 会话切换器「详情」
- **操作:** 查看会话元数据、消息统计、创建/更新时间
- **Server:** `GET /v2/notebooks/:nid/sessions/:sid`
- **代码:** `apps/web/src/features/workspace/domains/sessions/SessionDetailDialog.tsx`
- **截图:** `screenshots/session-detail-dialog.png`（待截图）

> NOTE: 待盘点
