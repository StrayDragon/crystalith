# Tasks — drop-material-tailwind-crystalith-ui-radix-headless

> Seam（复用既有 harness，无新 seam）：
> ① `just test-web`（Rstest：基础件 + 后期 MT-absent lock-test）
> ② `just e2e`（Playwright `@p0`，testid 字符串不变）
> ③ `bun typecheck`
> ④ `just qa`（P5 收口）
>
> 大范围替换按 expand-contract 分期，不拆无意义的垂直碎片。每期结束后 MT 仍可留在 deps，直到 T6。

## T0 证据复核与桶出口骨架

- [x] apply 开头重跑 proposal §证据刷新（文件数 / TW 与 MT 版本 / Dialog 调用面）
- [x] 新增 `apps/web/src/shared/ui/` 桶出口（可先空 re-export），确认 `features` 不反向依赖
- [x] `apps/web/AGENTS.md` Layer 示例：计划从「MT 用 LAYER_LEVELS」改为「基础件内部 useLayer」（正文改写放 T6，T0 只标缺口）
- 验证：`bun typecheck` 不因空桶失败

## T1 P1 展示件（Typography / Button / IconButton / Spinner / Chip）

- [x] 在共享 UI 层实现五件，`forwardRef`、透传 `className` / native 属性 / testid；variant 覆盖现用 `filled|outlined|text` 与 size；Spinner 纯 CSS
- [x] 默认外观抄当前 MT 调用面，不引入新视觉 token
- [x] 放置 RTL（渲染 variant、disabled、testid 透传）；走 `TestProviders`（此时仍可保留 MT ThemeProvider）
- 验证：`just test-web` 相关文件绿；`bun typecheck`

## T2 迁移 P1 调用面 [blocked-by: T1]

- [x] 将展示件 import 从 `@material-tailwind/react` 换到共享 UI 层（可分批：layout → sources → studio → lab）
- [x] ConfirmPopover 只换 Button/Typography，行为与 portal 不动
- [x] 保持所有 `data-testid` / `tid(TestIds.*)` 挂载点
- 验证：`just test-web`；至少跑一次 `just e2e`（顶栏/来源/Studio 关键 `@p0`）

## T3 P2 行为件（Menu / Popover / Tooltip） [blocked-by: T1]

- [x] 添加兼容 React 18.2 的 `@radix-ui/react-dropdown-menu` / `react-popover` / `react-tooltip`
- [x] 样式壳接入 `useLayer`（dropdown / popover / tooltip）；MUST NOT 硬编码 z-index
- [x] 迁移 Menu 四件套调用面（含 WorkspaceHeader 用户菜单、来源排序/行菜单、Chat/输出导出菜单等）
- [x] SessionSwitcher 的 MT Popover → Radix Popover；Tooltip 全替换
- [x] 打开态 portal 仍可被现有 testid 点到（必要时 `container={document.body}` 对齐现状）
- 验证：`just test-web`；`just e2e`（用户菜单、来源菜单相关 `@p0`）

## T4 P3 Dialog 壳 [blocked-by: T1]

- [x] 共享 Dialog 壳：portal + `useFocusTrap` + `useLayer('modal')` + Esc/遮罩关闭；API 覆盖现用 `open` / header / body / footer
- [x] 迁移 **4** 个 MT Dialog 调用面：StudioPanel、StudioToolsGrid、SlidesStudioDialog、SearchResultsQueue（两处）
- [x] SourceDetailDialog 保持 portal，不回退到 MT Dialog
- [x] 不引入 Radix Dialog
- 验证：`just test-web`；`just e2e`（来源详情、Studio/幻灯片对话框相关 `@p0`）

## T5 P4 表单与杂项 [blocked-by: T1]

- [x] Input / Textarea / Checkbox / Alert / Progress 自研并替换调用面
- [x] ModelSelector：Select/Option → Radix Select + Alert 自研
- [x] SourceDetailDialog Tabs → 自研或 Radix Tabs（三 tab，保留现有 testid）
- [x] 不实现 Avatar / List / Card
- 验证：`just test-web`；`bun typecheck`；涉及表单的现有 RTL 全绿

## T6 P5 卸载 MT 与分包 [blocked-by: T2, T3, T4, T5]

- [x] lock-test：源码与 `apps/web/package.json` 均不再出现 `@material-tailwind/react`
- [x] 移除 `withMT`；若缺 utility 则内联到基础件或全局 CSS，保留 `ui/*` 与 streamdown token
- [x] 移除 `ThemeProvider`（`main.tsx` + `test-utils/providers.tsx`）与 `src/types/material-tailwind.d.ts`
- [x] `bun remove @material-tailwind/react`；`rsbuild` `vendor-material-tailwind` → `@radix-ui` + `@floating-ui`
- [x] 审计 `@mui/material`：无组件 import 则尝试删除；icons 安装/类型失败则保留并在 PR 说明
- [x] 更新 `apps/web/AGENTS.md`（Design System / Layer 示例去掉 MT）
- 验证：`bun typecheck`；`just test-web`（含 lock-test）；`just e2e`

## T7 收口 [blocked-by: T6]

- [x] `just qa` 全绿
- [x] 抽查明暗两态：顶栏用户菜单、来源行菜单、Studio 笔记对话框、来源详情 Tabs——相对替换前无故意视觉改动
- 验证：`just qa`
