## 1. 断点与状态装配

- [x] 1.1 新增/复用媒体查询 hook，用于判断 `< md` 与 `>= md`（支持监听视口变化）
- [x] 1.2 在顶层集中封装 panel id 与渲染目标的映射（`refine` 对应 Studio/输出中心），避免散落条件分支

## 2. 移动端单面板布局

- [x] 2.1 在 `WorkspaceLayout` 增加 mobile/desktop 分支渲染：mobile 渲染单面板容器；desktop 保持 `ModularCanvas`
- [x] 2.2 为 mobile 增加底部 TabBar（可复用/改造 `WorkspaceTabs`），支持切换 Sources / Chat / Studio
- [x] 2.3 确保 TabBar 切换不会清空关键状态（Chat 草稿、来源选择、输出列表/队列），并确保顶部 `WorkspaceHeader` 的关键入口在窄屏仍可用

## 3. 安全区与视口高度

- [x] 3.1 TabBar 适配 `safe-area-inset-bottom`，避免被 iOS home indicator 遮挡
- [x] 3.2 将 Workspace 顶层高度策略从 `h-screen` 调整为 `100dvh`（或等价）以缓解移动端地址栏导致的裁切/跳动
- [x] 3.3 复核 Chat 输入区与底部 TabBar 的叠放关系（键盘弹起时不遮挡主要交互）

## 4. 文档更新

- [x] 4.1 更新相关文档说明移动端用法（单面板 + 底部 TabBar；布局编辑仅桌面端）

## 5. 验证

- [x] 5.1 运行前端检查：`cd frontend/web && pnpm test && pnpm typecheck && pnpm run lint && pnpm run build`
- [x] 5.2 运行后端回归：`cd backend/py && just test`
- [x] 5.3 手动验证：浏览器设备模拟（iPhone/Android）下可顺畅切换三面板，且 TabBar 不被 safe-area 遮挡
