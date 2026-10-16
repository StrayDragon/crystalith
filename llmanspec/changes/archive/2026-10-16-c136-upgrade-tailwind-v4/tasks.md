# Tasks

> 本 change 属「大范围机械改动扫全库」例外：按**先加后删**排序（@theme 就位并验证后再删 JS config），不强行垂直切片。全部判据在 change 分支上测量。

## T1 依赖切换与构建接线

- [x] `apps/web`：`tailwindcss` 升 `^4`，新增 `@tailwindcss/postcss`；删除 `autoprefixer`、`tailwind-scrollbar`（package.json + bun install）
- [x] `postcss.config.cjs` 插件换 `@tailwindcss/postcss`，删 autoprefixer 项
- [x] `tailwind.css` 头部：`@tailwind ×3` → `@import "tailwindcss"` + `@source` + `@custom-variant dark`（实施修正：streamdown dist 无法用 @source 相对路径扫——oxide 拒绝相对路径进 node_modules；改为 `@source inline(...)` 类白名单 `streamdown-sources.css`，权威差分法生成，见 design 修正）
- [x] `bun run dev:web` 构建冒烟通过；若报 oxide 原生二进制缺失，显式补 `@tailwindcss/oxide-linux-x64-gnu` / `@tailwindcss/lightningcss-linux-x64-gnu`

**验证**：dev build 成功、页面可渲染（允许中间态样式部分缺失）。

## T2 tailwind.css CSS-first 重写（付清核心债）

- [x] `@theme` 迁移：fontFamily、slate 别名、`--sd-*` 桥接色（color-mix 形态）、brand 50–900、ui 语义色（注意保持既有类名等价，见 design D2）、boxShadow soft/glow、keyframes/animation slide-in/out
- [x] `@layer utilities` 自定义类（`cl-h-dvh`、`ux-*` 系）**保留原样**（实施修正：无变体组合需求，@utility 无增益，等价迁移优先缩小 diff 面）
- [x] 暗色覆盖块（`.dark .bg-* !important` ×15）保留并实测生效（dev server 亮/暗切换）
- [x] **移除 T1 的 `@config` 临时桥接**

**验证**：`rg '@config' apps/web/src/app/tailwind.css` 零命中；`bun run dev:web` 下主界面 / Chat / LabGraph 样式目检正常。

## T3 codemod 类名重命名 + `!` 后缀化

- [x] Node 20+ 跑 `npx @tailwindcss/upgrade`（在 T2 完成的 CSS-first 基础上，codemod 只处理模板类名），diff 全量 review
- [x] 人工核对重命名热点：裸 `rounded`（603）、`ring`（56，默认 1px + currentColor 重灾区）、`shadow-sm`（37）、`flex-shrink`（62）、`outline-none`（20）、`blur-sm`（12）、`bg-gradient-to-`（2）
- [x] `!` 前缀 → 后缀 `class!`（约 20 处，LabGraph MiniMap/Controls 覆盖为主），逐处确认 reactflow 内置样式仍被压过
- [x] 撤 `LabGraph.tsx` 两处 `fallow-ignore-next-line css-broken-reference`；若 fallow 对后缀语法仍误报则重新抑制并注明

**验证**：`rg -l '"[^"]*\s![a-z]' apps/web/src -g '*.tsx'` 检查残留 `!` 前缀类为零；`just test-web` 绿。

## T4 删旧（先加后删收尾）

- [x] 删除 `apps/web/tailwind.config.cjs`
- [x] `rg "tailwind\.config|tailwind-scrollbar" apps/web/package.json apps/web bun.lock` 零命中
- [x] `docs/known-issues.md`：c127 裁延条目 tailwindcss 行改写为已完成（保留表格其余行）
- [x] `apps/web/DESIGN.md` token 值与 `@theme` 对齐复核（值不变仅核对，不改文档结构）

**验证**：全局 rg 零残留；`just qa` 不因删除报警。

## T5 UI 库 lock-test（streamdown 产物类守护）

- [x] 新增 rstest（挂 `apps/web` 既有 test:ci）：扫描 `node_modules/streamdown/dist` 与 `@streamdown/*/dist` 提取消费的 tailwind 类名 → 固化清单快照 → 断言 Rsbuild 生产构建产物 CSS 含全部类
- [x] 快照清单纳入 git（人为可读、可 diff）

**验证**：`just test-web` 绿；人为删掉 `@source` streamdown 路径时该测试转红（负例自证一次后恢复）。

## T6 全量回归与收口

- [x] `just qa` 全绿（含 fallow audit 增量门禁、e2e @p0——testid 锚点即 web-ui-foundation r341 守护）
- [x] 亮/暗巡检结论：工作台亮/暗布局正常（bg-gray-100→#1e293b 覆盖块 computed 等价）；LabGraph（demo 页）reactflow 渲染 + MiniMap/Controls 后缀 important 全命中（m-3!→12px、bg-white/95、shadow-xs!→0 1px 2px/5%）；Chat streamdown 运行时渲染因后端未启由 71 类 lock-test + 产物验证覆盖。巡检面：Workspace 主界面、Chat（streamdown 渲染）、LabGraph（reactflow + `!` 后缀覆盖）、Slides 预览入口、系统对话框（Radix + Layer）
- [x] 产物 CSS 体积对比（**如实记录：raw +34% 超出 ±30% 判据**，87.7→117-119KB，主因 v4 @property + color-mix 双写；gzip 18.8KB 绝对值极小，@theme inline 试验仅省 0.4%；详见 design D6）
