---
depends_on: []
skip_specs_landing: true
---

# Web 前端构建基础设施迁移：Vite → Rsbuild/Rspack

## Why（背景与动因）

- 本仓库 web SPA（`apps/web`）当前构建/dev 栈为 Vite 7（Rollup）+ `@vitejs/plugin-react`（Babel），
  生产构建约 18.7s（本机实测全量）。
- Rstack 工具链（Rsbuild + Rspack）同生态已有成熟技能与迁移指南
  （`rstackjs.agent-skills`：migrate-to-rsbuild / rsbuild-best-practices / rspack-*）；
  本机 PoC 实测生产构建 3.9–4.1s、dev 冷编译约 1s，浏览器冒烟 0 console 错误。
- 迁移是**纯构建/工具链层**：不改任何对外行为合约（HTTP/Eden wire、ResearchRun、openapi、
  前端 UI 行为语义、`VITE_*` 语义均不变），因此 `skip_specs_landing: true`。

## What Changes（按相位，详见 design.md / research.md）

- **Phase 1（构建层切换到 Rspack）**
  - `apps/web`：`vite`/`@vitejs/plugin-react` → `@rsbuild/core` + `@rsbuild/plugin-react`（SWC）。
  - 新增 `rsbuild.config.ts`：alias / dedupe / dev proxy（含 `/slidev` ws）/ `server.strictPort` /
    `loadEnv({ prefixes:['VITE_'] })` 逐项平移；`html.template` + `source.entry` 替代 index.html 入口。
  - **B1 必改**：`pptxgenjs` 的 `node:fs`/`node:https` 动态导入在 Rspack 解析器为 Unhandled scheme
    （alias/fallback/aliasFields 均不生效，PoC 实测），需 `rspack.NormalModuleReplacementPlugin` 兜底
    或升级/替换库。
  - **B2 必改**：Vite 函数式 `manualChunks` → Rspack `splitChunks.cacheGroups`（正则 `test` +
    `per-package` preset；避免函数式 `test`，Rspack 官方警告性能）。
  - env/类型：`vite-env.d.ts` 的 `vite/client` → `@rsbuild/core/types`；`vite.config.ts` 测试块拆出为
    `vitest.config.ts`（Phase 1 保留 Vitest，且 Vite 作为其 transform 底座留在 devDeps）。
  - CLI/进程引用替换：`Procfile`、`justfile`（dev-web/test-web 等）、`e2e/playwright.config.ts`
    webServer、`apps/web/scripts/core_suite.mjs`、package.json scripts；server 端
    `scripts/build-release.ts` 无需改（走 scripts）。
- **Phase 2（可选决策门：测试栈）**
  - 方案 A：保留 Vitest（零改动，Vite 留 devDeps，官方推荐）。
  - 方案 B：全面 Rstest（`@rstest/core` + `@rstest/adapter-rsbuild`），可彻底移除 Vite；
    已 PoC 验证 jsdom + RTL + jest-dom + MSW 可用；代价是 81 个测试文件 `vi.→rs.` 机械改写、
    `setupTests.ts`、`core_suite.mjs`、tsconfig 类型，以及 `labDemoMode.test.ts` 3 个依赖
    `import.meta.env.DEV` 运行时存根的用例改写（Rstest 下 `DEV` 是编译期 define，PoC 实测真值字符串
    `"false"`）。**Phase 2 独立成 change 或本 change 内独立子阶段，apply 时二次确认。**

## Capabilities（影响域）

- `apps/web`（构建配置、src/types、scripts、测试）
- 根 `Procfile` / `justfile` / `package.json`（脚本引用）
- `e2e/`（playwright webServer 命令）
- `apps/server/scripts/build-release.ts`（仅回归验证，无代码改动）
- `packages/crystalith-slidev`：**不迁移**（@slidev/cli 原生 Vite，独立进程，仅 dev 代理沿用）。

## Impact（影响与边界）

- **BREAKING（对外）**：无。HTTP 合约、wire schema、UI 行为语义、`VITE_LAB_DEMO`/`VITE_API_BASE_URL`
  语义全部保持不变。
- **产物差异（内部）**：`dist/` 结构由 `assets/` 变为 `static/`、script 由 `type=module` 变为 `defer`、
  chunk 名/数量变化（分包策略重写）——需一次产物级回归（server 静态托管冒烟 + e2e @p0）。
- **dev 体验差异（已知）**：HMR 为 chunk 级（非 Vite 模块级），dev 产物为预打包 chunk；冷编译更快。
- **运行时**：Rsbuild/Rspack/Rstest 要求 Node `^20.19.0 || >=22.12.0`（本机 Node v22.14 ✓）；
  Bun 下经 `bun --bun` 已验证 build/dev 可用；`bunx` 默认走 node shebang。
- **回滚边界**：Phase 1 完成后旧 `vite.config.ts` 暂不删除、`vite` 留在 devDeps，可一键回滚
  （详见 design.md §回滚边界）。
- **新增工件**：无生成式 artifacts；若引入 drift 门禁（如 `bun run build` 快照对比）仅作可选巡检。

## 测试边界（seam，与用户确认）

复用既有 harness，无新 seam：

1. `bun run build`（apps/web 生产构建 → dist）
2. `bun run dev:web`（dev server 起服无错，端口 3000）
3. `bun run test:ci`（web Vitest / 或 Phase 2 后 rstest，81 文件）
4. `just e2e`（Playwright @p0 浏览器门禁）
5. `bun typecheck`（全仓）
6. 浏览器冒烟（复用 e2e fixtures/系统 Chrome，非新 harness）：打开 dev 页确认 React 渲染、
   console/page 0 error、`/v1`·`/v2`·`/slidev`(ws) 代理连通
