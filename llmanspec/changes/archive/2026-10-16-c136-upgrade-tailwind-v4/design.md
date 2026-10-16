# Design: Tailwind v4 一步到位升级

## D1. 决策记录

| 决策点     | 选择                                                             | 理由                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 迁移策略   | **一步到位 CSS-first**，不用 `@config` 兼容层                    | 用户指令：不留双轨。`@config` 允许 JS config 继续工作，但 theme 同时存在于 JS 与 CSS 两处，债务原样携带；一步付清后 `tailwind.css` 成为唯一样式 SSOT           |
| 接线方式   | `@tailwindcss/postcss`（PostCSS 插件）                           | Rsbuild 内建 PostCSS 支持，官方指南路径；`@rsbuild/plugin-tailwindcss` 为性能优化项，暂不引入（避免一次引入两个变量）                                          |
| scrollbar  | **直接删除** tailwind-scrollbar                                  | 全仓（apps/web/src、tailwind.css、streamdown dist、crystalith-slidev src）零 `scrollbar-*` 类消费，死依赖；v4.3 已有一方 scrollbar 工具，将来需要可零成本启用  |
| 暗色覆盖块 | `.dark .bg-* !important` 15 条**原样保留**                       | v4 中 `@layer base` 内 important 声明按反转层序胜过 `@layer utilities` 的 normal 声明，语义与 v3 等价；重写成 `@variant dark` 语义类反而扩大 diff 面与回归风险 |
| 类名重命名 | Node 20+ 跑官方 `npx @tailwindcss/upgrade` codemod + 人工 review | 裸 `rounded` 603 处等机械量太大不宜手改；codemod 已发布近两年，成熟度可接受；diff 全量 review                                                                  |
| `!` 前缀   | codemod 后**手工**改后缀 `class!`（约 20 处）                    | 量小、集中（LabGraph reactflow 覆盖、暗色边框覆盖），手工可控且能顺带撤 fallow 抑制注释                                                                        |

## D2. 现状 → 目标映射

### 依赖

```
- tailwindcss ^3.4.19          → tailwindcss ^4
+ @tailwindcss/postcss（新增）
- autoprefixer（删除，v4 内置 vendor prefixing）
- tailwind-scrollbar ^3.1.0（删除，死依赖）
```

Bun 注意：`@tailwindcss/oxide` 平台二进制走 optionalDependencies，bun install 偶发漏装（tailwindlabs/tailwindcss#15806）；dev/build 冒烟若报 `cannot find module '@tailwindcss/oxide-linux-*'`，显式 `bun add -d @tailwindcss/oxide-linux-x64-gnu @tailwindcss/lightningcss-linux-x64-gnu`。

### 接线

`apps/web/postcss.config.cjs`：

```js
// v3                                // v4
module.exports = {                   module.exports = {
  plugins: {                           plugins: {
    tailwindcss: {},                     '@tailwindcss/postcss': {},
    autoprefixer: {},                  },
  },                                 };
};
```

### tailwind.css 结构映射（v3 → v4）

| v3（现状）                                                    | v4（目标）                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tailwind base/components/utilities`                         | `@import "tailwindcss";`                                                                                                                                                                                                    |
| config `content`（src / crystalith-slidev / streamdown dist） | `@source "../**/*.{ts,tsx}";` 等显式指令（streamdown dist 必须精确，勿放宽引发全 node_modules 扫描）                                                                                                                        |
| config `darkMode: 'class'`                                    | `@custom-variant dark (&:where(.dark, .dark *));`                                                                                                                                                                           |
| `theme.extend.fontFamily.sans/mono`                           | `@theme { --font-sans: ...; --font-mono: ...; }`                                                                                                                                                                            |
| `theme.extend.colors.slate`（对 gray 的别名）                 | `@theme { --color-slate-*: ...; }`（直接引用 palette，或保留 colors import 等价色值）                                                                                                                                       |
| `--sd-*` 桥接色 `rgb(var(--sd-background) / <alpha-value>)`   | `@theme { --color-background: rgb(var(--sd-background)); ... }`——v4 经 color-mix 原生支持 `/opacity` 修饰，`<alpha-value>` 机制废弃                                                                                         |
| `brand.50–900`                                                | `@theme { --color-brand-50: #eff6ff; ... }`                                                                                                                                                                                 |
| `ui.*` 语义色（text/text-muted/border/bg 等）                 | `@theme { --color-ui-text: ...; }`（类名从 `ui-text` 变为 `text-ui-text` 形态——**注意**：v4 嵌套颜色命名空间生成 `bg-ui-text` 类形，语义色名需逐个核对映射后的类名与既有模板用法一致，必要时调整 token 命名以保持类名不变） |
| `theme.extend.boxShadow.soft/glow`                            | `@theme { --shadow-soft / --shadow-glow: ...; }`                                                                                                                                                                            |
| `theme.extend.keyframes/animation`（slide-in/out）            | `@theme { --animate-slide-in: slide-in 0.3s ease-out; @keyframes slide-in {...} }`（keyframes 内联进 @theme）                                                                                                               |
| config `plugins: [scrollbar(...)]`                            | 删除（死依赖）                                                                                                                                                                                                              |
| `@layer utilities { .cl-h-dvh / .ux-* }`                      | `@utility cl-h-dvh { ... }` 等逐个迁移                                                                                                                                                                                      |
| `@layer base { :root/--sd-*/暗色覆盖 }`                       | `@layer base` 结构保留（`:root` 变量与暗色覆盖块不动）                                                                                                                                                                      |

**关键约束：类名等价**。`@theme` 迁移后必须保证模板里既有类（`bg-brand-500`、`text-muted-foreground`、`shadow-soft`、`animate-slide-in` 等）生成的 CSS 与 v3 等价；T5 lock-test 以此为验收。

### 模板类名重命名清单（codemod 覆盖，人工复核）

| v3                 | v4                                                                   | 本仓暴露量 |
| ------------------ | -------------------------------------------------------------------- | ---------- |
| 裸 `rounded`       | `rounded-sm`                                                         | 603        |
| `shadow-sm`        | `shadow-xs`（档位整体上移）                                          | 37         |
| `flex-shrink-*`    | `shrink-*`                                                           | 62         |
| 裸 `ring`          | `ring-3`（v4 默认 1px 且颜色 blue-500→currentColor，**视觉重灾区**） | 56         |
| `outline-none`     | `outline-hidden`                                                     | 20         |
| `blur-sm`          | `blur-xs`                                                            | 12         |
| `bg-gradient-to-*` | `bg-linear-to-*`                                                     | 2          |
| `!` 前缀           | `class!` 后缀（手工）                                                | ~20        |

## D3. UI 库保障设计（用户硬性要求：不影响 UI 库）

1. **streamdown**（`@streamdown/*`，聊天 markdown 渲染）：其 dist 内组件消费 shadcn 风格类（`bg-muted`、`text-muted-foreground` 等），这些类**必须**由我们的 `@theme`（`--sd-*` 桥接）生成——tailwind 不再扫 dist 就静默丢样式。
   - 防线 1（编译期）：`@source "../../node_modules/streamdown/dist/*.js"` 与 `@source "../../node_modules/@streamdown/*/dist/*.js"` 显式精确覆盖；
   - 防线 2（测试期，T5）：rstest lock-test——扫描 streamdown dist 提取其全部消费类名清单（固化快照），断言 Rsbuild 生产构建产物 CSS 含每个类。任一缺失即测试红。
2. **crystalith-slidev**（slides 工作台组件库，`main: src/index.ts` 由 apps/web 构建消费）：`@source` 覆盖 `packages/crystalith-slidev/src`；回归靠既有 e2e slides 链路（studio-slides-workflow spec 的 @p0 场景）。
3. **reactflow**（LabGraph 深研图视图）：其内置样式与我们的 `!` important 覆盖（MiniMap/Controls 边框阴影）互动最密；`!` 后缀化后亮/暗巡检重点看 LabGraph。
4. **Radix（headless 行为件）**：不消费 tailwind 类（样式壳全自研），零影响；e2e @p0 的 testid 锚点（web-ui-foundation r341）即守护网。

## D4. 风险与回滚

| 风险                               | 等级 | 缓解                                                                     |
| ---------------------------------- | ---- | ------------------------------------------------------------------------ |
| ring/shadow/rounded 档位视觉回归   | 高   | codemod + e2e @p0 + 亮/暗人工巡检；diff 全量 review                      |
| 暗色覆盖块与真实 CSS layers 交互   | 中   | 理论推演成立（important 层序反转）；dev server 亮/暗切换实测列入 T6 判据 |
| streamdown 类静默丢失              | 中   | D3 双防线（@source 显式 + 产物 lock-test）                               |
| Bun 漏装 oxide 原生二进制          | 低   | 显式平台包；CI 与本机各冒烟一次                                          |
| codemod 误改（把非类字符串当类名） | 低   | diff review；`just qa` 兜底                                              |

回滚：单分支 change，`git revert` 整体可逆；锁文件与 tailwind.css 同 commit 粒度切换。

## D5. 验收判据（全部在 change 分支上测量）

1. `bun run dev:web` 构建成功，产物 CSS 体积与 v3 同量级（±30%）；
2. T5 lock-test 绿：streamdown 类清单全量命中产物；
3. `just qa` 全绿（typecheck / lint / format / fallow audit 增量门禁 / server+shared 单测 / web rstest / e2e @p0）；
4. 亮/暗双主题人工巡检：Workspace 主界面、Chat（streamdown 渲染）、LabGraph（reactflow）、Slides 预览入口、系统对话框；
5. `rg '@config' apps/web/src/app/tailwind.css` 零命中（零兼容层承诺可验证）；
6. `rg "tailwind-scrollbar|tailwind.config" apps/web package.json bun.lock` 零命中（死依赖与旧 config 清除）。

## D6. 实施修正记录（apply 阶段固化）

1. **`@source` 无法扫 node_modules（方案变更）**：oxide 拒绝相对路径进入 node_modules（bun symlink + .gitignore 布局，对照实验证实非 symlink 根因）；绝对路径可放行但不可移植。改用 `@source inline(...)` 类白名单 `src/app/streamdown-sources.css`，清单由「绝对路径权威构建 vs 无扫描构建」的产物类集差分生成。**差分法有盲区**：tailwind.css 注释文本恰含的类（bg-muted/80）两边都被生成而抵消——由 rstest 动态扫描锁（dist token 类 ⊆ 白名单）兜住并补齐。
2. **白名单维护流程**：streamdown 升级 → rstest `streamdown-classes.test.ts` 红（新 token 类不在白名单）→ 按 streamdown-sources.css 头注释的差分法更新；「配置有效性」由 `scripts/verify-streamdown-css.mjs`（postcss 真实编译断言 71 类全生成）验证——rstest/Rspack 环境加载不了 lightningcss 原生模块故独立于 rstest。
3. **死配置不携带（零债原则的延伸）**：v3 config 中 `brand.50–900`、`ui.*` 语义色、slide-in/out keyframes、`shadow-soft/glow` 经审计全部零消费（shadow-soft 的产物命中来自 CSS 注释文本），未迁入 `@theme`。
4. **类名重命名误伤与修复**：精确脚本替代官方 codemod（项目已先切 v4 引擎，codemod 不适用）；三轮误伤（DOM API `.blur()`、`!border` 前缀碰撞产生 `border!-xxx`、单引号字符串漏网）全部修复并清零验证。
5. **等价性关键点**：暗色覆盖块 `.dark .shadow-sm` 随重命名改指 `.dark .shadow-xs`（v3 shadow-sm 的语义继承者），避免 v3 裸 shadow（→v4 shadow-sm）被意外覆盖。
6. **产物体积（判据如实记录）**：index CSS 87.7 KB(v3) → 117-119 KB(v4)，raw +34~35%，**超出 D5 的 ±30% 判据**；gzip 后 18.8 KB（绝对值小）。主因：v4 `@property` 声明 + var() 桥接 token 的 color-mix 双写。`@theme inline` 试验仅省 0.4%（131.8 vs 132.3 KB）不值得，维持 reference 形态。运行时影响可忽略，不阻塞。
