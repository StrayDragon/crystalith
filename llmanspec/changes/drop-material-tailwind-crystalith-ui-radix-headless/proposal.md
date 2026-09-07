---
depends_on: []
---

# 卸载 @material-tailwind/react：自研 crystalith UI 主题层（Radix headless 混合路线）

> **优先级与时效声明（先读这段）**：本变更**不是 public 发布线（A 线）的阻塞项**，排在
> `ship-server-binary` 等首要需求之后；发布过程中其他 change 随时可能加塞，**本文快照的
> 数字与文件路径在捡起时大概率已过期**。因此本文刻意写成「决策 + 判据 + 复测方法」而非
> 「执行清单」——捡起时先跑一遍 §证据刷新，用 10 分钟重新校准，再决定是否按既定路线执行。

## Why（背景与动因）

**1. MT 是 Tailwind v4 升级的唯一结构性阻塞。**
Tailwind v4 转向 CSS-first 配置（`@theme`、无 config.js），而 `@material-tailwind/react@2`
的安装方式就是用 `withMT()` 包裹 `tailwind.config.js`——两者机制性冲突（社区集中反馈见
tailwindlabs/tailwindcss#15958），MT 至今无官方 v4 路径。仓库现为 tailwind 3.4.19
（维护模式，只收 bug fix）。

**2. 生态税已经发生过一次，且会重复发生。**
2026-09 聊天流式 markdown 渲染（`streamdown-markdown-assistant-p0-1`，已归档）集成
streamdown 时踩坑：streamdown 按 v4 + shadcn token 语义发布——v3 下 `@source` 指令被
静默忽略（v4 才有），必须改走 content 扫描 + 手工补 `--sd-*` 设计 token。这次是靠排查
救回来的；下一个按 v4 语义发布的库未必有运气。**MT 不移除，v4 就一直升不了，这类税
就会一直交。**

**3. MT 依赖本身的价值在衰减。**
MT 维护不活跃（v2 停滞），而仓库对它的真实使用面极浅（见下），养一个全量组件库
只换来三种形态的按钮和一个 `variant="small"` 的文字组件，性价比不合理。

## 证据快照（2026-09-08，捡起时必须刷新）

**使用画像**：37 个文件 import MT，但 prop 深度接近零——

| 家族                                         | 文件数                                                               | 实际用到什么                                             |
| -------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| Typography                                   | 27                                                                   | 只有 `variant="small"`（48 处），≈ 带样式 `<p>`          |
| IconButton / Button                          | 20 / 18                                                              | 只有 default、`outlined`、`text` 三形态；`color` 仅 1 处 |
| Spinner                                      | 15                                                                   | 纯 CSS 动画                                              |
| Menu 四件套                                  | 10                                                                   | 标准下拉（排序/行菜单/用户菜单/导出）                    |
| Tooltip / Chip / Input / Textarea / Checkbox | 4-7                                                                  | 零散、标准用法                                           |
| **Dialog 四件套**                            | **仅 3**（SourceDetailDialog / StudioPanel / WorkspaceTopbarSearch） | 其余对话框早已自研 portal 化                             |

**已有自研地基**（新主题层的参照系）：`shared/layer`（6 层 z-index 体系）、
`useFocusTrap`、portal 对话框成熟样例（AddSourceFromUrlDialog / ExtractorPolicyDialog /
SourceConnectorsDialog）、自研 toast / ConfirmPopover、成文设计系统
`apps/web/DESIGN.md`（647 行：色板 + 暗色板 + typography scale）、tailwind.config 的
`ui/*` 语义色命名空间。

**附带疑点**：`@mui/material@7` 整包在 deps 中，疑似仅为 `@mui/icons-material` 的
peer（图标是独立 SVG 组件，不依赖 MUI 运行时）——执行时顺手审计能否瘦身。

### 证据刷新方法（捡起时执行）

```bash
cd apps/web
# 1) MT 使用面是否变化
grep -rl "@material-tailwind/react" src --include="*.tsx" | wc -l
# 2) 逐家族清单与 prop 深度（把 <c> 换成 Typography/IconButton/Button/Menu/Tooltip/Dialog…）
grep -rh -B8 "from '@material-tailwind/react'" src --include="*.tsx" | grep -oE "^\s+[A-Z][a-zA-Z]+,?$" | tr -d ' ,' | sort | uniq -c | sort -rn
grep -rhoE 'Button[^>]*?(variant|color|size)="[a-z]+"' src --include="*.tsx" -o
# 3) MT 是否已有官方 v4 支持release（若已有，本变更的动机要重评）
#    查 material-tailwind.com/docs/react/release-notes
# 4) Tailwind 主版本（若已升 v4——理论上不可能绕过本变更，核查为准）
node -e "console.log(require('tailwindcss/package.json').version)"
```

刷新后按「变化量决定执行方式」：使用面仍在上述量级 → 按既定路线走；MT 用法变深
（出现复杂表单/复杂 Dialog 组合）→ 重估混合路线比例；MT 官方出了 v4 路径且我们决定
留在 v3 生态 → 本变更可降级为「仅审计」甚至关闭。

## What Changes（路线与分期）

**路线决策：混合式。** 行为件（Menu/Popover/Tooltip/Dialog）用 **Radix UI headless**
（无样式、只提供焦点管理/键盘导航/定位/ARIA，React 18 兼容）+ 自研样式壳接入
`useLayer`；展示件（Typography/Button/IconButton/Spinner/Chip 等）**纯自研**。

备选已否决：(a) 纯自研含行为件——a11y（焦点循环/方向键/ARIA）自担，成本 +2-3 天且
是长期负债；(b) 继续 MT 等官方 v4——无时间表且方向不可控；(c) 换 MUI 等重型库——
与 DESIGN.md 既有视觉体系和轻量诉求反向。

分期（每期独立可验证、独立提交，e2e @p0 + 明暗截图对比保绿）：

- **P1 展示件**：Typography / Button / IconButton / Spinner / Chip → 新建
  `shared/ui/` 基础组件（每件 30-80 行），DOM 类名从 MT 渲染结果抄为默认值，视觉零漂移。
- **P2 行为件**：Menu 四件套 / Popover / Tooltip → Radix primitive + 样式壳 + `useLayer`。
- **P3 Dialog**：仅存 3 处 MT Dialog 迁移到既有自研 portal + useFocusTrap 模式。
- **P4 表单与杂项**：Input / Textarea / Checkbox / Tabs / Select / Avatar / Alert。
- **P5 卸载**：移除 `withMT`（如 `ui/*` 配色引用了 MT theme 注入值则内联）、卸载依赖、
  审计 `@mui/material` 去留。

**不做的事**：不借机重设计视觉（DESIGN.md 为准，零视觉漂移是验收线）；不动
`@mui/icons-material`（图标独立可用）；不在此 change 内升 Tailwind v4（卸载 MT 之后
v4 是独立的后续小 change，届时 streamdown 的 content 扫描可换回原生 `@source`）。

## Capabilities

- `web-ui-foundation`（新，如正式化时认为需要单独立约）：自研 UI 基础组件层与
  headless 行为件的使用约定；testid 挂载点不因替换而变化的稳定性要求。

## Impact

- `apps/web/package.json`：-`@material-tailwind/react`，+若干 `@radix-ui/react-*`；
  审计 `@mui/material`
- `apps/web/tailwind.config.js`：去 withMT；`ui/*` 语义色保留
- `apps/web/src/shared/ui/`（新）+ 37 个文件的 import 机械替换
- 风险与对策：① a11y 回归 → Radix 承担行为层；② e2e 破坏 → 替换时保持
  `data-testid` 挂载点与可访问名不变，逐期跑 `just e2e`；③ 视觉漂移 → DOM 类名
  抄写策略 + 每期明暗两态截图对比；④ **本提案过期** → 以 §证据刷新 的复测结果为准，
  决策框架（混合路线 / 分期 / 验收线）比数字更持久。
