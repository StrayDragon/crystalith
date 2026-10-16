---
depends_on: []
needs_specs_change: false
title: Tailwind CSS 一步到位升级 v4——CSS-first 重写，零兼容层
branch: sdd/c136-upgrade-tailwind-v4
base_branch: main
base_sha: cf16e443f405d3d49c238fb78d1172c9a566cf27
---

# Tailwind v3 → v4 一步到位升级（CSS-first，无 @config 兼容层）

## Why

- `apps/web` 锁在 `tailwindcss ^3.4.19`，v3 已停止功能演进；c127 当初将 3→4 裁延，理由是「css-first theme 重写 + @source + tailwind-scrollbar@4 连动 + 43 处 `!important` 交互回归，预估 >1 天」（见 `docs/known-issues.md` 依赖升级遗留表）。
- 2026-10 复核，四大障碍全部消解或可控：`@config` 兼容层存在（但本 change 明确**不用**，见下）；tailwind-scrollbar 在本仓库是**死依赖**（src / tailwind.css / streamdown dist / crystalith-slidev 全无 `scrollbar-*` 类消费）；`!` 前缀语法 v4 弃用但仍可运行；`!important` 交互面经分析收敛为「暗色覆盖块层序 + 工具类重命名视觉回归」两类，均有 codemod / e2e 兜底。
- **决策：一步到位 CSS-first，不留 `@config` 兼容层**（用户指令）。理由：兼容层意味着 JS config 与 `@theme` 双轨并存，历史债务原样携带进新体系；一次付清成本，后人得到单一 SSOT（`tailwind.css`）而非两份配置。

## What Changes

- **依赖切换**：`tailwindcss ^3.4.19 → ^4`，新增 `@tailwindcss/postcss`（PostCSS 接线，Rsbuild 官方支持路径）；**删除** `autoprefixer`（v4 内置）与 `tailwind-scrollbar`（死依赖，全仓零消费）。
- **`apps/web/src/app/tailwind.css` 全量重写为 CSS-first**：
  - `@tailwind base/components/utilities` ×3 → `@import "tailwindcss"`；
  - `tailwind.config.cjs` 的 theme（fonts / colors 含 `--sd-*` shadcn 桥接 / brand / ui 语义色 / boxShadow / keyframes / animation）→ `@theme` token（`--sd-*` 桥接改 color-mix 形态，保留透明度修饰能力）；
  - content globs（src / crystalith-slidev src / streamdown dist）→ `@source` 指令；
  - `darkMode: 'class'` → `@custom-variant dark`；
  - `@layer utilities` 自定义类（`cl-h-dvh`、`ux-*` 等）→ `@utility` API；
  - **`.dark .bg-* !important` 暗色覆盖块（15 条）原样保留**——v4 真实 CSS layers 下 important 声明层序反转仍使其生效，验收时亮/暗双主题实测。
- **删除 `tailwind.config.cjs`**（先加后删：@theme 就位并验证后再删）。
- **模板类名收尾**：官方 `npx @tailwindcss/upgrade` codemod 处理重命名（裸 `rounded`×603、`ring`×56+`ring-N`×25、`shadow-sm`×37、`outline-none`×20、`blur-sm`×12、`flex-shrink`×62、`bg-gradient-to-`×2 等），人工 review diff；`!` 前缀 → 后缀 `class!`（约 20 处，LabGraph reactflow 覆盖为主）。
- **撤 fallow 抑制**：`LabGraph.tsx` 两处 `fallow-ignore-next-line css-broken-reference` 注释随 `!` 后缀化一并撤销；若 fallow 对 v4 后缀语法仍误报，按 fallow 规则重新抑制并注明。
- **UI 库保障（硬性验收）**：
  - streamdown（聊天 markdown 渲染，dist 内消费 `bg-muted` 等 shadcn 类）：新增 rstest lock-test 断言**构建产物 CSS** 含其全部消费类名（类扫描失败会静默丢样式，必须上锁）；
  - `packages/crystalith-slidev`（slides 工作台组件，由 web 构建编译）：`@source` 显式覆盖 + 既有 e2e slides 链路回归；
  - reactflow（LabGraph 图视图）：`!` 后缀化后视觉回归巡检。
- **台账收口**：`docs/known-issues.md` c127 裁延条目中 tailwindcss 行删除/改写为已完成；`apps/web/DESIGN.md` 色值 token 与 `@theme` 对齐复核（token 值不变，仅承载机制变化）。

## Capabilities

- 触及但**不改合约**：`web-ui-foundation`（r341 testid 锚点 / r342 组件库边界——由既有 e2e @p0 场景守护，本 change 是工具链等价迁移）、`quality-and-regression`（just qa 门禁本身不变，本 change 须过门禁）。
- 故 `needs_specs_change: false`：视觉与行为等价迁移，无对外行为语义变更。

## Impact

- **范围**：`apps/web`（全量 utility 类面 + tailwind.css + 构建接线）、`packages/crystalith-slidev`（仅被扫描方式变化）、根锁文件。
- **风险集中点**：`ring`/`shadow`/`rounded` 视觉档位偏移（量大但机械，codemod 覆盖）；暗色覆盖块与真实 CSS layers 的交互（理论推演成立，必须实测）；Bun 安装 `@tailwindcss/oxide` 原生二进制偶发漏装（已知 issue，显式补平台包可解）。
- **验收 seam（全部复用既有 harness）**：`just test-web`（rstest）+ 新增产物 CSS 类存在性 lock-test（挂 rstest）+ `just e2e @p0`（含 testid 锚点守护）+ `just qa` 全绿 + 亮/暗双主题人工视觉巡检（记录在 tasks 验证判据）。
- **不做**：Tauri 桌面端联动（本就暂缓）；v4.3 内置 scrollbar 工具采用（当前无消费，需要时另起小 change）。
