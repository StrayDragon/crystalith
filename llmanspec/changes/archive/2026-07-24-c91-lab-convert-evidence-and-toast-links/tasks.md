# Tasks: c91-lab-convert-evidence-and-toast-links

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r445–r446 + scenarios
- [x] `llman sdd validate c91-lab-convert-evidence-and-toast-links --strict --no-interactive`

## Apply（`llman-sdd-apply`）

### 1. Toast action API

- [x] 1.1 `toast.tsx`：optional `action: { label, onClick }`；`success/error/info/warning` 第二参兼容 `number | options`
- [x] 1.2 Vitest：action 按钮可见且点击触发 onClick

### 2. Convert success 弱链

- [x] 2.1 `edenConvertActions` 成功 toast 附「打开工作区」→ `navigateToWorkspace`
- [x] 2.2 更新 `edenConvertActions.test`（含 evidence artifact 与 action）

### 3. Per-evidence convert UI

- [x] 3.1 `LabNodeDrawer` 引用列表：每条证据转为笔记/来源（`kind=evidence`）
- [x] 3.2 fixture：stub toast；Eden：调用既有 convert helpers
- [x] 3.3 Vitest：evidence convert 入口（Eden 调 API / fixture 不调）

### 4. 验证

- [x] 4.1 `cd apps/web && bun run test:ci`（或相关 Vitest）+ typecheck 相关
- [x] 4.2 `llman sdd validate c91-lab-convert-evidence-and-toast-links --strict --no-interactive`
