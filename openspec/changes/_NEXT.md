# NEXT - 续做接力记录

更新时间：2026-02-08 11:05 CST
分支：`main`

## 1) 当前总状态（下次开工先看这里）

- `add-dark-mode-v2` 已归档：`openspec/changes/archive/2026-02-08-add-dark-mode-v2/`
- `add-keyboard-shortcuts` 已完成并归档：`openspec/changes/archive/2026-02-08-add-keyboard-shortcuts/`
- `_SEQ` 已更新：新增 `2e` 归档状态，下一优先级切到 `add-output-export-v2`

## 2) 本轮已完成（开发 -> 测试 -> 验收）

### A. 快捷键系统能力

- 新增 `useKeyboardShortcuts`（注册/注销/分发/冲突检测/输入框冲突规避）：
  - `frontend/web/src/features/workspace/shared/hooks/useKeyboardShortcuts.ts`
- 新增快捷键配置映射：
  - `frontend/web/src/features/workspace/shared/shortcuts.ts`
- 新增帮助面板（`Ctrl+?`，分类展示，走 LayerProvider z-index）：
  - `frontend/web/src/features/workspace/layout/ShortcutHelpPanel.tsx`
- 集成到工作区布局（`Ctrl+K/N/1/2/3/Ctrl+Enter/Escape/Ctrl+?`）：
  - `frontend/web/src/features/workspace/layout/WorkspaceLayout.tsx`

### B. 快捷键相关增强

- Notebook hook 增加快捷创建能力（供 `Ctrl+N` 调用）：
  - `frontend/web/src/features/workspace/domains/notebooks/useNotebooks.ts`

### C. 自动化测试与验收

- Hook 单元测试：
  - `frontend/web/src/features/workspace/shared/hooks/useKeyboardShortcuts.test.tsx`
- Live E2E 交互测试：
  - `frontend/web/e2e/workspace.shortcuts.live.spec.ts`
- 已通过命令：
  - `pnpm test --run src/features/workspace/shared/hooks/useKeyboardShortcuts.test.tsx`
  - `pnpm test:e2e --project=live --grep "keyboard shortcuts"`
  - `pnpm run build`
  - `openspec validate add-keyboard-shortcuts --strict --no-interactive`
  - `openspec archive add-keyboard-shortcuts --yes`

## 3) 下一步（按 _SEQ）

1. 推进 `add-output-export-v2`：先读 `proposal.md / tasks.md / (design.md)`。
2. 按流程执行：开发 -> 测试 -> 验收 -> 勾选任务 -> 归档 -> 提交。

## 4) 备注

- Obsidian 相关继续暂缓。
- 若后端本地 DB 存在历史枚举值（如 `READY`）导致 `/v1/notebooks` 500，优先使用 `/tmp` 独立配置启动后端做验收。
