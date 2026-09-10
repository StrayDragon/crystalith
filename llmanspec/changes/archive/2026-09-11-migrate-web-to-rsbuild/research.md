# Research：Vite → Rsbuild/Rspack 迁移可行性（××××-××-×× 实测）

> 本文件是迁移决策的调研快照（用户要求的「调研固化」）。事实以命令输出为准；
> 环境：Node v22.14.0 / Bun 1.4.0，Rsbuild 2.2.5 / Rspack 2.2.3 / Rstest 0.11.12（均当前 latest）。
> 结论：**可行，无硬 blocker**；1 个解析器缺陷需 workaround（B1）、1 个配置必须重写（B2）、
> 1 个测试栈决策（B3）；其余为机械替换。

## 1. 现状盘点（Vite 耦合面）

| 面       | 现状                                                                                                                                                                                            | 迁后落点                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 构建/dev | `vite` 7 + `@vitejs/plugin-react`（Babel）                                                                                                                                                      | `@rsbuild/core` + `@rsbuild/plugin-react`（SWC）                                                                                                                                                    |
| 配置     | `vite.config.ts`（alias/dedupe/函数式 manualChunks/proxy 含 `/slidev` ws/`fs.allow`/vitest `test` 块）                                                                                          | `rsbuild.config.ts`（proxy/alias/dedupe 直接对应；`fs.allow` 不需要——Rspack 不按 HTTP 提供源文件）；vitest 拆 `vitest.config.ts`                                                                    |
| env      | `import.meta.env.DEV`（4 处）、`VITE_LAB_DEMO`、`VITE_API_BASE_URL`（`src/api/viteEnv.ts`）；`vite-env.d.ts` 引用 `vite/client`                                                                 | DEV/PROD/MODE/BASE_URL Rsbuild 内置；`VITE_*` 用 `loadEnv({prefixes:['VITE_']})`（官方 CRA 同款）；类型换 `@rsbuild/core/types`（其 `ImportMetaEnv extends Record<string,any>`，现有 augment 兼容） |
| 测试     | Vitest 3 + RTL + MSW(node) + jest-dom；81 测试文件；`test:ci`/`test:core`/`test:all`；`scripts/core_suite.mjs` spawn `vitest`；`VITEST_INCLUDE_EXPERIMENTAL`/`VITEST_MSW_ON_UNHANDLED` 环境开关 | Phase 1 保留；Phase 2 可迁 Rstest（见 §4）                                                                                                                                                          |
| e2e      | `e2e/playwright.config.ts` webServer 用 `bunx vite --host … --port … --strictPort`                                                                                                              | `bunx rsbuild dev --port …`；strict 行为落 `server.strictPort:true`（rsbuild CLI 无 `--strictPort` 旗标）                                                                                           |
| 进程/CI  | `Procfile`（web: `bun run dev`）、`justfile`（dev-web/test-web/qa）、`scripts/build-release.ts` 调 `bun run build`                                                                              | 仅 CLI 名替换；build-release 无需改                                                                                                                                                                 |
| slidev   | `packages/crystalith-slidev`（@slidev/cli 原生 Vite）                                                                                                                                           | **不动**；dev 代理 `/slidev`（ws:true）继续成立                                                                                                                                                     |

源码扫描：无 `import.meta.glob`、无 `?raw/?url/?worker/?inline`、无 `new Worker`、无
`import.meta.hot`、web src 无 node 内置包导入、无 emotion `css prop`（SWC 无 Babel 依赖）。✅

## 2. PoC 实证（本机，全部为真实运行）

| 项             | 结果                                                                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 生产构建       | Rsbuild `3.9–4.1s`（`bun --bun` 与 node 两种运行时均通过）vs Vite 基线 `18.7s`；js 总量 ~16.8MB×2 侧大体相当；demo 代码随 `VITE_LAB_DEMO` 开关的保留行为与 Vite **逐字节一致**（未置时 demo 代码同样留在包内，属既有行为非回归） |
| Bun 运行时     | `bun --bun …/rsbuild.js build` 与 `dev` 均正常（N-API binding OK）；`bunx rsbuild` 默认走 node shebang，纯 Bun 需 `--bun` 前缀                                                                                                   |
| dev server     | 冷编译 ~1s；`host:true`、端口占用自增 3000→3001 正常                                                                                                                                                                             |
| 真实浏览器冒烟 | Playwright（系统 Chrome）打开 Rsbuild dev 页：`#root` 渲染 23929 字节，**console 0 错误 / page 0 错误**（连本机 8032 真实 API）                                                                                                  |
| Rstest 试点    | jsdom+RTL+jest-dom ✅（需 `globals:true`，否则 RTL 不清 DOM 导致多元素匹配）；MSW(node)+SWR ✅；`rs.fn/mock/hoisted/spyOn/stubEnv/resetModules` 全映射 ✅；`import.meta.env.DEV` 为编译期 define（stub 无效）❌                  |

> 构建时长只是量级参考（Rspack 有持久缓存、分包策略不同），非严谨基准。真正体验差异：
> dev HMR 为 **chunk 级**热更、dev 产物为**预打包 chunk**（如 dev `lib-react.js` 1.2MB），与
> Vite 模块级 HMR 不同——唯一明显的体验降级点。

## 3. Blocker / 必改项（按严重度）

### 🔴 P0（构建必须处理，均已在 PoC 验证）

- **B1 — `pptxgenjs` 的 `node:` URI**
  - `dist/pptxgen.es.js` 内 `await import('node:fs') / node:https`（Node 分支，运行时被 `isNode`
    守卫；浏览器永不执行）。Vite 靠 `browser` field 映射 `false` 静默吞掉；**Rspack 把 `node:` 当
    URI scheme：`resolve.alias`/`resolve.fallback`/`resolve.aliasFields` 全部截不到**（逐一实测），
    构建直接报 `Unhandled scheme`。
  - PoC 打通方式：`tools.rspack.plugins: [ new rspack.NormalModuleReplacementPlugin(/^node:(fs|https)$/, 空模块) ]`。
  - 备选：升级/替换 pptxgenjs（当前 4.0.1，需查上游是否修复）；或向 Rspack 提交 resolver issue。
- **B2 — 分包策略重写**
  - Vite `build.rollupOptions.output.manualChunks`（函数式，按包名分组 + 每包一个 `vendor-*` chunk）
    → Rspack `splitChunks.cacheGroups`（`test: /[\\/]node_modules[\\/]@mui[\\/]/` 等命名分组 +
    `preset:'per-package'` 兜底）。**Rspack 官方警告函数式 `test` 显著拖慢构建**（JS↔Rust
    跨语言调用），应尽量用正则。
  - ⚠️ apply 实测补充：Rsbuild ≥2.0 该配置位于**顶层 `splitChunks`**（v1 的
    `performance.splitChunks` 会被静默忽略）；`preset:'per-package'` 兜底 chunk 命名为
    `npm-*`（与 Vite `vendor-*` 前缀不同，属预期）。
  - 产出 chunk 名/数量/顺序会变 ⇒ 一次性产物回归（见 Behavior 回归清单）。

### 🟡 P1（必改的配套）

- **B3 — 测试栈决策（二选一，见 §4）**
- **B4 — env 与类型**：`loadEnv({prefixes:['VITE_']})` 已实测注入 shell 中的 `VITE_*`；
  `vite-env.d.ts` 换 `@rsbuild/core/types`。
- **B5 — CLI/进程引用**：`Procfile`、`justfile`（dev-web/test-web 等）、`e2e` webServer、
  `apps/web/scripts/core_suite.mjs`；`rsbuild` CLI 无 `--strictPort` ⇒ e2e strict 行为落 config。
- **B6 — 产物差异回归**：`dist/` 结构由 `assets/` → `static/js|css`、`defer` 脚本、（prod 默认）无
  `.map`；server 静态托管（`CL_WEB_DIST`/二进制旁 dist）需一次冒烟。

### 🟢 P2（注意即可）

- HMR 粒度差异（见 §2）；`bunx` 默认 node 运行时；slidev 保持 Vite 不动；两套 bundler 并存期
  （Phase 1 选 A 时）。

## 4. 测试栈决策（B3）

**方案 A：Rsbuild 管构建，Vitest+Vite 保留**（官方迁移指南推荐）

- 零风险：81 测试文件不动；`vite` 仅作 vitest transform 底座留在 devDeps。
- 缺点：devDeps 两套 bundler；「切换」只覆盖构建层。

**方案 B：全面 Rstest**（`@rstest/core` + `@rstest/adapter-rsbuild`，复用 rsbuild.config.ts）

- PoC 试点：toast（RTL+act）✅、useDependencyHealth（MSW+SWR+waitFor）✅；
- ⚠️ `rs.stubEnv('DEV', …)` 无效——`import.meta.env.DEV` 是编译期 define（测得真值字符串
  `"false"`），影响 `apps/web/src/features/research-lab-demo/labDemoMode.test.ts` 3 个用例
  （依赖 stub DEV 断言 demo 闸门）；这些小例子改写为「只测 `VITE_LAB_DEMO` 闸门，DEV 视为环境常量」。
- 迁移清单：81 文件 `vi.→rs.` + `from 'vitest'→'@rstest/core'`（机械 codemod）→ `setupTests.ts`
  import 替换 + `expect.extend`（已是显式）→ tsconfig `vitest/globals`→`@rstest/core/globals` →
  `core_suite.mjs` spawn `rstest` → env 开关更名/保留 → 修 `labDemoMode.test.ts`。

深度指标：`vi.*` 使用量 vi.fn(187)/vi.mock(37)/vi.hoisted(36)/vi.spyOn(28)/vi.stubEnv(7)/fake
timers(若干)，Rstest 0.11.12 均已提供 `rs.*` 等价 API。

**建议**：一步到位走 B（单工具链、Rstest 编译型更快），但作为独立子阶段（Phase 2）在 Phase 1
门禁全绿后再动；中间态合法可暂停。

## 5. 官方文档锚点

- 迁移指南（Vite）：https://rsbuild.rs/guide/migration/vite
- 环境变量（`loadEnv`/前缀）：https://rsbuild.rs/guide/advanced/env-vars.md
- dev server（proxy ws / host / strictPort）：https://rsbuild.rs/config/server/proxy.md
- 分包：https://rsbuild.rs/config/split-chunks.md 、https://rspack.rs/plugins/split-chunks-plugin
- Rspack resolve（aliasFields/fallback，B1 背景）：https://rspack.rs/config/resolve.md
- Rstest 迁移（Vitest）：https://rstest.rs/guide/migration/vitest.md
- 本地技能：`.agents/skills/` 下 `migrate-to-rsbuild` / `rsbuild-best-practices` /
  `rspack-split-chunks` / `migrate-to-rstest`（rstackjs.agent-skills 子模块）

## 6. 遗留疑问（apply 前需决策/验证）→ apply 后复核结论（2026-09-11）

1. pptxgenjs 上游是否已修 `node:` 导入？→ **未修**：4.0.1（latest，2025-06-26 发布）dist 内仍含
   `import('node:fs')`×2 / `import('node:https')`×1；按原方案落地 NormalModuleReplacementPlugin
   补丁（构建产物 0 处 `node:` 引用，导出链路由单元 + e2e 双回归）。
2. Phase 2 选 A 还是 B？→ **选 B（全面 Rstest）**（apply 决策门用户确认，2026-09-11）；
   81 文件 codemod + labDemoMode 注入式改写 + runner 接线后 `test:ci` 80 文件/310 用例全绿。
3. `per-package` + 命名 cacheGroups 最终分包对比 → **实测不劣化**：首屏 Vite ~170 请求
   （含 elkjs 1.4M 同步）vs Rsbuild 10 个 JS 请求（index 604K + 共享 chunk 3.3M + vendor-*）；
   JS gzip 总量 3560K vs 3341K（+6.5%）；shiki langs/themes 两侧均异步加载。
4. dev 阶段 `/slidev` ws 代理真实 Studio 回放 → **已复核关闭（2026-09-11，内置浏览器实测，
   overmind 全栈 server:8032 / rsbuild dev:3000 / slidev:3030）**：
   ① `/slidev/` 经代理 200 + Slidev 完整 UI；② ws 升级经代理握手 OPEN 并收
   `{"type":"connected"}`（`ws://host/slidev/?token=<hmr>` + 子协议 `vite-hmr`，与直连
   :3030 行为一致）；③ 键盘翻页 1/2→2/2、过渡动画渲染正常（截图）；④ Studio 同款
   `waitForSlidevPreviewReady` 轮询 + 同源 iframe 挂载 → deck title 可读；⑤ 页面无
   `vite-error-overlay`。注意：ws 探测须带**尾斜杠**路径与子协议，否则超时（探测姿势，
   非代理缺陷）。
