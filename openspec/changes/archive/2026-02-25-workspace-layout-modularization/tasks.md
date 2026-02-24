## 1. 拆分 overlays 的展示组件

- [x] 1.1 新增目录：`frontend/web/src/features/workspace/layout/overlays/` 与 `.../layout/hooks/`
- [x] 1.2 从 `WorkspaceLayout.tsx` 提取 overlays 展示组件（viewer、graph view、source/session detail dialogs、slides dialog、catalog/command palette/shortcut help），保持 props-only（不含副作用）

## 2. 收敛 overlay state 与关闭策略

- [x] 2.1 实现 `useWorkspaceOverlays()`（或等价命名）：集中管理 overlays state 与 open/close handlers
- [x] 2.2 将 `closeActiveOverlay` 逻辑迁移到 overlays hook（或拆成可测试的纯函数），并保证所有资源清理在同一处完成

## 3. 拆分 graph/session detail 的数据加载

- [x] 3.1 提取 `handleGraphSessionClick` 的消息加载逻辑到专用 hook（例如 `useGraphSessionDetail`）
- [x] 3.2 确保加载状态、错误处理与清理逻辑不回归

## 4. 回归与验收（含 DevTools）

- [x] 4.1 `cd frontend/web && pnpm test && pnpm run typecheck`
  - `pnpm test`: 20 files / 81 tests passed
  - `pnpm run typecheck`: passed
- [x] 4.2 启动前端：`cd frontend/web && pnpm dev`
  - 通过，Vite 启动在 `http://127.0.0.1:5173/`
- [x] 4.3 手动回归清单（DevTools 打开 console/network）：
  - Escape 依次关闭：命令面板/目录/帮助/graph dialogs/viewer/slides 等，关闭顺序与清理正确
  - Sources/Chat/Studio 三个核心模块可正常渲染与交互
  - 打开知识图谱/输出 viewer/Slides dialog 后无前端运行时报错；Network 正常（`/analysis` 返回 500 为现有后端数据问题）
