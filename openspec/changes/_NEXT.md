# NEXT - 续做接力记录

更新时间：2026-02-08 11:47 CST
分支：`main`

## 1) 当前总状态（下次开工先看这里）

- `add-dark-mode-v2` 已归档：`openspec/changes/archive/2026-02-08-add-dark-mode-v2/`
- `add-keyboard-shortcuts` 已完成并归档：`openspec/changes/archive/2026-02-08-add-keyboard-shortcuts/`
- `add-output-export-v2` 已完成并归档：`openspec/changes/archive/2026-02-08-add-output-export-v2/`（`workspace-ui` spec 已更新）
- `_SEQ` 已更新：补齐 `2f` 归档状态；下一步回到延后项评估

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

### D. 输出导出（add-output-export-v2）

- 新增导出基础设施（格式映射 + 文件名 + 内容转换）：
  - `frontend/web/src/features/workspace/domains/outputs/exporters.ts`
  - `frontend/web/src/features/workspace/domains/outputs/useExport.ts`
- 输出查看器增加统一导出入口（Markdown/JSON/PDF/PPTX）：
  - `frontend/web/src/features/workspace/domains/outputs/OutputContent.tsx`
- Studio 输出列表菜单集成导出动作：
  - `frontend/web/src/features/workspace/domains/studio/StudioOutputsList.tsx`
- 新增单元测试：
  - `frontend/web/src/features/workspace/domains/outputs/exporters.test.ts`
  - `frontend/web/src/features/workspace/domains/outputs/useExport.test.tsx`
  - `frontend/web/src/features/workspace/domains/outputs/OutputContent.test.tsx`
- 已通过命令：
  - `pnpm -C frontend/web test --run src/features/workspace/domains/outputs/*`
  - `pnpm -C frontend/web run build`
  - `openspec validate add-output-export-v2 --strict --no-interactive`
  - `openspec archive add-output-export-v2 --yes`
- DevTools 手动验收：
  - FAQ/Quiz/Briefing/Slides 的导出菜单展示正确（Markdown + 特殊格式）
  - 点击导出可触发浏览器下载（DevTools 通过 `URL.createObjectURL` 计数验证）

## 3) 下一步（按 _SEQ）

1. 评估是否继续收尾 `optimize-frontend-performance` 延后项（2.5/2.6）。
2. 评估是否继续收尾 `enhance-ux-polish` 延后项（3.3/3.4）。
3. 若继续推进新提案：优先从 `add-database-migration` / `add-backend-dependency-injection` 等低耦合项开始。

## 4) 备注

- Obsidian 相关继续暂缓。
- 若后端本地 DB 存在历史枚举值（如 `READY`）导致 `/v1/notebooks` 500，优先使用 `/tmp` 独立配置启动后端做验收。
