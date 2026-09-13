---
depends_on: []
branch: sdd/drop-material-tailwind-crystalith-ui-radix-headless
base_sha: 9c29f41c11bd514a0b50e98292c53c1a9d0e58f2
---

# 卸载 @material-tailwind/react：自研 crystalith UI 主题层（Radix headless 混合路线）

> 本变更**不是** public 发布线阻塞项。数字以 §证据快照为准；决策框架（混合路线 / 分期 / 零视觉漂移 / testid 稳定）比清单更持久。

## Why

**1. MT 是 Tailwind v4 升级的唯一结构性阻塞。**
Tailwind v4 转向 CSS-first 配置（`@theme`、无 config.js），而 `@material-tailwind/react@2`
的安装方式就是用 `withMT()` 包裹 `tailwind.config.js`——两者机制性冲突（社区集中反馈见
tailwindlabs/tailwindcss#15958），MT 至今无官方 v4 路径。仓库现为 tailwind 3.4.19
（维护模式，只收 bug fix）。

**2. 生态税已经发生过一次，且会重复发生。**
2026-09 聊天流式 markdown 渲染（`streamdown-markdown-assistant-p0-1`，已归档）集成
streamdown 时踩坑：streamdown 按 v4 + shadcn token 语义发布——v3 下 `@source` 指令被
静默忽略（v4 才有），必须改走 content 扫描 + 手工补 `--sd-*` 设计 token。**MT 不移除，
v4 就一直升不了，这类税就会一直交。**

**3. MT 依赖本身的价值在衰减。**
MT 维护不活跃（v2 停滞），而仓库对它的真实使用面极浅（见下），养一个全量组件库
只换来有限形态的按钮、文字、菜单与少量表单控件，性价比不合理。

## 证据快照（2026-09-13 刷新）

仍为 **37** 个文件引用 `@material-tailwind/react`；tailwind **3.4.19**；MT **2.1.10**。
相对 2026-09-08 草案，**Dialog 使用面变深**（见下），其余家族量级不变。

| 家族 | 实际形态 | 备注 |
| --- | --- | --- |
| Typography / Button / IconButton / Spinner / Chip | 展示件，prop 浅 | P1 纯自研 |
| Menu 四件套 | ~10 个调用面（排序/行菜单/用户菜单/导出等） | P2 Radix dropdown |
| Tooltip | ~7 个调用面 | P2 Radix tooltip |
| Popover 三件套 | 仅 SessionSwitcher | P2 Radix popover；ConfirmPopover 已自研 portal |
| **Dialog 四件套** | **4 个文件仍用 MT Dialog**：StudioPanel、StudioToolsGrid、SlidesStudioDialog、SearchResultsQueue（内含两处） | P3 迁到既有 portal + focus-trap；SourceDetailDialog **已是** portal，只剩 Tabs |
| Input / Textarea / Checkbox | 标准表单 | P4 自研 |
| Select / Option / Alert | 仅 ModelSelector | P4 Select 走 Radix（键盘/ARIA）；Alert 自研 |
| Tabs 五件套 | 仅 SourceDetailDialog | P4 自研或 Radix Tabs |
| Progress | 仅 AddSearchResultDialog | P4 自研 |
| ThemeProvider | `main` + 测试 providers | P5 删除 |
| Avatar / List / Card | **源码未使用**（仅类型声明） | 不实现 |

**已有自研地基**：`shared/layer`（6 层 z-index）、`useFocusTrap`、多处 portal 对话框、自研 toast / ConfirmPopover、`DESIGN.md` token、`tailwind.config` 的 `ui/*` 语义色、`shared/testids.ts`（e2e 锚点 SSOT）。

**MUI**：`@mui/icons-material` 广泛使用，保留。`@mui/material` **零组件 import**，疑似 icons peer——P5 审计去留；不借机换图标集。

### 证据刷新方法（apply 开头再跑一次）

```bash
cd apps/web
rg -l "@material-tailwind/react" src --glob "*.{ts,tsx}" | wc -l
node -e "console.log(require('tailwindcss/package.json').version)"
node -e "console.log(require('@material-tailwind/react/package.json').version)"
```

刷新后：使用面仍在上述量级 → 按既定路线；MT 用法显著变深 → 重估混合比例；MT 官方出 v4 且决定留 v3 生态 → 本变更可降级关闭。

## What Changes

**路线决策：混合式。**

- **展示件**（Typography / Button / IconButton / Spinner / Chip / Input / Textarea / Checkbox / Alert / Progress）：纯自研，样式对齐现用 MT 默认类名 + `DESIGN.md` / `ui/*`，**零视觉再设计**。
- **行为件**（Menu / Popover / Tooltip）：**Radix UI headless**（焦点、键盘、定位、ARIA）+ 自研样式壳 + `useLayer`。React 18 锁定下选用兼容的 Radix 发行线。
- **Dialog**：**不引入 Radix Dialog**。剩余 MT Dialog 迁到与既有 URL/诊断/连接器对话框同一套 portal + focus-trap + Layer，避免两套 overlay SSOT。
- **Select**：Radix Select（唯一需要完整列表键盘行为的表单控件）。
- **Tabs**：浅层（来源详情三 tab）→ 自研或 Radix Tabs，以 a11y 最小集为准。

备选已否决：(a) 纯自研含行为件——a11y 自担，长期负债；(b) 等 MT 官方 v4——无时间表；(c) 换 MUI 组件——与既有视觉和轻量诉求反向。

分期（每期独立可验证；testid 与可访问名不变）：

- **P1 展示件**：Typography / Button / IconButton / Spinner / Chip → 共享 UI 层；调用面机械替换。
- **P2 行为件**：Menu 四件套 / Popover / Tooltip → Radix primitive + 样式壳 + Layer。
- **P3 Dialog**：4 个 MT Dialog 调用面 → 共享 Dialog 壳（portal + focus-trap + Layer）。
- **P4 表单与杂项**：Input / Textarea / Checkbox / Tabs / Select / Alert / Progress。
- **P5 卸载**：去掉 `withMT` 与 ThemeProvider、删除 MT 依赖与类型补丁、分包 chunk 从 MT 改为 Radix、审计 `@mui/material`。

**不做的事**：不借机重设计视觉；不动 `@mui/icons-material`；**不在本 change 内升 Tailwind v4**（卸载 MT 之后另开 change）；不实现未使用的 Avatar/List/Card。

## Capabilities

- `web-ui-foundation`（新）：共享 UI 基础层与 headless 行为件约定；testid / Layer 不因替换而漂移；运行时 MUST NOT 再依赖 Material Tailwind。
- `workspace-ui-core`（引用，不改锁定规则）：弹层策略仍见既有 overlay/Layer 约束。

## 测试边界（seam）

复用既有 harness，**无新 seam / 无新 BDD runner**：

1. `apps/web` Rstest（`just test-web` / `bun run test:ci`）——基础件单测 +「源码/依赖不再引用 MT」lock-test
2. `just e2e`（Playwright `@p0`，testid 锚点）
3. `bun typecheck`
4. `just qa`（收口）

不新增 Playwright fixture；`e2e/fixtures/testids.ts` 与 `shared/testids.ts` 字符串不变。本仓库 `bdd:` 段未启用；UI 验收走 Rstest + e2e，不把 Gherkin runner 扩到前端（避免改全项目 `validate --check`）。

## Impact

- `apps/web/package.json`：-`@material-tailwind/react`，+若干 `@radix-ui/react-*`；可能 -`@mui/material`（审计后）
- `apps/web/tailwind.config.js`：去 `withMT`；`ui/*` 与 streamdown token 保留
- 共享 UI 层（新）+ 约 37 个文件 import 替换；`rsbuild` 分包 `vendor-material-tailwind` → Radix/floating-ui
- **BREAKING（对外 HTTP/Eden）**：无。用户可见交互语义保持；仅实现层组件库替换。
- 风险与对策：① a11y 回归 → Radix 承担 Menu/Popover/Tooltip/Select；Dialog 复用已有 focus-trap；② e2e 破坏 → 保持 testid 与可访问名；③ 视觉漂移 → 抄现用类名 + 不改 DESIGN token；④ Dialog 面比旧草案更深 → P3 按 4 文件而非 3 文件排期。
