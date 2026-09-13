# Design：卸载 Material Tailwind，落地 crystalith UI + Radix headless

## 1. 目标架构

```
apps/web/src/shared/ui/          # 新增：展示件 + 行为件样式壳（唯一 MT 替换出口）
  index.ts                       # 桶导出；业务面只从这里（或子路径）取基础件
  Button.tsx / IconButton.tsx / Typography.tsx / Spinner.tsx / Chip.tsx
  Input.tsx / Textarea.tsx / Checkbox.tsx / Alert.tsx / Progress.tsx
  Dialog.tsx                     # portal + useFocusTrap + useLayer('modal')
  Menu.tsx / Popover.tsx / Tooltip.tsx   # Radix primitive + 样式 + useLayer
  Select.tsx / Tabs.tsx          # Select=Radix；Tabs=浅层自研或 Radix
apps/web/src/shared/layer/       # 不变：z-index SSOT
apps/web/src/shared/testids.ts   # 不变：e2e 锚点字符串
apps/web/src/app/main.tsx        # P5：去掉 MT ThemeProvider
apps/web/tailwind.config.js      # P5：去掉 withMT
```

依赖方向（与 architecture-core r5 一致）：`features/*` → `shared/ui`；`shared/ui` MUST NOT 依赖 workspace domain。

## 2. 混合路线（为何 Dialog 不用 Radix）

| 类别                     | 选型                                     | 理由                                                                                             |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 展示件                   | 自研                                     | prop 面极浅；自研 30–80 行可抄现用 className                                                     |
| Menu / Popover / Tooltip | Radix headless + 样式壳                  | 焦点循环、方向键、定位、ARIA；仓库无意自研这份 a11y                                              |
| Dialog / modal           | **自研 portal + `useFocusTrap` + Layer** | 多数对话框已是这条路；再引入 Radix Dialog = 两套 overlay SSOT，与 workspace-ui-core 弹层策略冲突 |
| Select                   | Radix Select                             | 唯一需要列表键盘导航的表单件                                                                     |
| Tabs / Checkbox / Input  | 自研（Tabs 若 a11y 不够再升 Radix Tabs） | 用法浅                                                                                           |
| ConfirmPopover           | **保持自研**                             | 已有 placement/portal；只换内部 Button/Typography                                                |

否决：全自研行为件；等 MT v4；用 `@mui/material` 组件替换 MT。

Radix 包（P2/P4 按需加，禁止一次引全家桶）：`@radix-ui/react-dropdown-menu`、`react-popover`、`react-tooltip`、`react-select`；Tabs 若升 Radix 再加 `react-tabs`。版本须兼容锁定的 React 18.2。

## 3. 视觉零漂移策略

- 验收线是**不借机重设计**：`DESIGN.md` token 与 `theme.extend.colors.ui` 保持；不改品牌色/字号阶梯。
- 基础件默认 className 从**当前 MT 调用面实际用到的 variant**抄（filled / outlined / text；size sm/md/lg；`color="blue"` 仅 1 处），并 `forwardRef` + 透传 `className` / native 属性 / `data-testid`。
- 调用面已有的 Tailwind override 原样保留；基础件只提供 MT 被依赖的默认外观。
- 不实现源码未使用的 Avatar / List / Card。

## 4. 迁移 + 回滚边界

expand-contract，MT 直到 P5 才卸载：

1. **Expand**：在共享 UI 层加新件（可与 MT 并存）；测试 providers 在 P5 前仍可包 MT ThemeProvider，以免半迁移测试崩。
2. **Migrate**：按 P1→P4 替换 import；每期后跑 seam（§6）。
3. **Contract（P5）**：零 MT import 后删除依赖、`withMT`、`ThemeProvider`、`material-tailwind.d.ts`；`rsbuild` `vendor-material-tailwind` 改为 `@radix-ui` + `@floating-ui`。

回滚：P5 之前 = 还原该期 commit，MT 仍在 deps。P5 之后 = 还原 P5 commit（依赖与 config）。不保留 MT 兼容包装层。

`@mui/material`：P5 用「无 `@mui/material` import + icons 是否仍声明 peer」决定删除或保留；**不删除** `@mui/icons-material`。若删 `@mui/material` 导致 icons 安装失败，则保留 peer、记录原因。

## 5. 风险登记

| 风险                                                    | 等级 | 缓解                                                                                             |
| ------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| Menu/Tooltip 打开后 e2e 点不到（portal/pointer-events） | 高   | 保持现有 `data-testid` 挂在 trigger/list 上；Radix `modal`/`container` 对齐现状；每期 `just e2e` |
| Dialog 焦点/Esc/遮罩与 Layer 打架                       | 高   | 复用已验证的 portal 对话框模式，抽一层壳而不是第三套                                             |
| withMT 去掉后 `ui/*` 或 MT 注入的默认 theme 类丢失      | 中   | P5 前对照 computed class；缺的 utility 内联到基础件或 `tailwind.css`                             |
| Radix 与 React 18.2 不兼容                              | 中   | 锁定兼容 18 的 Radix 发行；禁止顺手升 React 19                                                   |
| 视觉回归（暗色）                                        | 中   | 不改 token；关键面（顶栏菜单、来源行菜单、Studio 对话框）手动明暗对照                            |
| `@mui/material` 误删导致 icons 坏                       | 低   | P5 先 `bun install` 验证再提交                                                                   |

## 6. 测试 seam（复用既有 harness，无新 seam）

- `just test-web`：基础件 RTL + MT-absent lock-test（源码与 `package.json` 不再出现 `@material-tailwind/react`）
- `just e2e`：`@p0` testid 行为不变
- `bun typecheck`
- `just qa`：P5 收口

不启用项目级 `bdd:` runner（会改变全仓库 `validate --check`）；feature 里的 `@executable` 只做结构挂接，执行面仍是上述 harness。
