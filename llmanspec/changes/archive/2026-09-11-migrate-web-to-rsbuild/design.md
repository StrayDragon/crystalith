# Design：Web 前端构建基础设施迁移 Vite → Rsbuild/Rspack

## 1. 目标架构

```
apps/web/
├── rsbuild.config.ts        # 新增：构建/dev 权威配置（替代 vite.config.ts 的 build/dev 职责）
├── vitest.config.ts         # Phase 1 新增：仅测试配置（react 插件 + alias + test 块）
├── vite.config.ts           # Phase 1 保留但瘦身（仅被 vitest 引用）→ Phase 2 后删除（选 B）
├── src/vite-env.d.ts        # 引用 `@rsbuild/core/types`；ImportMetaEnv augment 保持不变
├── tsconfig.node.json       # include 指向 rsbuild.config.ts / vitest.config.ts
└── dist/                    # Rsbuild 默认产物（static/js|css、defer script、public 原样拷贝）
```

### 1.1 rsbuild.config.ts 核心映射（PoC 已验证逐项成立）

| Vite 配置                                                                     | Rsbuild 配置                                                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `plugins: [react()]`                                                          | `plugins: [pluginReact()]`（SWC）                                                                          |
| `resolve.alias`（含 `@brand`→`../../assets`、workspace 包→src、react 单副本） | `resolve.alias` 原样平移                                                                                   |
| `resolve.dedupe: ['react','react-dom']`                                       | `resolve.dedupe`（官方映射表确认）                                                                         |
| `build.rollupOptions.output.manualChunks`（函数式）                           | `splitChunks.cacheGroups` 重写（§3）                                                                       |
| `server.port/host/proxy`（含 `/slidev` ws:true）                              | `server.port/host/proxy`（http-proxy-middleware，ws 支持）                                                 |
| `server.fs.allow`                                                             | 不需要（Rspack dev 不按 HTTP 提供源文件）                                                                  |
| `import.meta.env.VITE_*`                                                      | `source.define = loadEnv({prefixes:['VITE_']}).publicVars`（PoC 实证注入 shell env）                       |
| index.html 内 `<script src="/src/app/main.tsx">`                              | `source.entry { index: './src/app/main.tsx' }` + `html.template`（模板去掉 script 标签，Rsbuild 自动注入） |
| `envDir`/`mode`/`base`（默认）                                                | 默认一致；`browserslist` 由 `package.json` 读取                                                            |

### 1.2 运行方式

- dev：`bun run dev:web`（或 Procfile `web:`）→ `rsbuild dev`（node shebang 或 `bun --bun` 均可，PoC 双验证）。
- build：package.json `build: rsbuild build`；`scripts/build-release.ts` 无改动。
- e2e：`e2e/playwright.config.ts` webServer → `bunx rsbuild dev --host 127.0.0.1 --port ${WEB_PORT}`；
  strict 行为由 `rsbuild.config.ts` 的 `server.strictPort: true` 承担（CLI 无 `--strictPort` 旗标，已查 CLI 文档）。

## 2. B1：pptxgenjs `node:` URI —— 必改点

- 事实（research.md §3 B1）：Rspack 把 `node:fs` 当 URI scheme，alias/fallback/aliasFields 均截不到。
- 方案（PoC 已验证）：`tools.rspack.plugins` 注入
  `new rspack.NormalModuleReplacementPlugin(/^node:(fs|https)$/, 空模块路径)`。
  `pptxgenjs` 的 Node 分支被 `isNode` 运行时守卫，浏览器永不执行 ⇒ 空模块替换**语义安全**。
- 决策点：apply 前先查 pptxgenjs 上游（最新版本）是否修复；若修复则退化为依赖升级，不用补丁。
- 备选：长期向 Rspack 反馈 resolver 对 `node:` scheme 的浏览器 field/alias 支持缺失。

## 3. B2：分包策略重写

现 Vite `manualChunks` 语义（PoC 基线输出核对）：
`vendor-react / vendor-mui(emotion+mui+hoist) / vendor-export-jspdf / vendor-export-pptxgenjs /
vendor-framer-motion / vendor-material-tailwind(+@floating-ui) / vendor-xyflow(+d3) /
vendor-gridstack / vendor-virtuoso / vendor-state(swr+zustand) / vendor-openapi / vendor-<pkg>（兜底）`。

Rspack 重写（建议，避免函数式 test）：

```ts
splitChunks: {
  preset: 'per-package',            // 兜底：node_modules 每包一个 chunk
  cacheGroups: {
    libReact:       { test: /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/, name: 'vendor-react', priority: 20 },
    vendorMui:      { test: /[\\/]node_modules[\\/](@emotion|@mui|emotion-|hoist-non-react-statics)[\\/]/, name: 'vendor-mui', priority: 20 },
    exportJspdf:    { test: /[\\/]node_modules[\\/]jspdf[\\/]/, name: 'vendor-export-jspdf', priority: 20 },
    exportPptx:     { test: /[\\/]node_modules[\\/]pptxgenjs[\\/]/, name: 'vendor-export-pptxgenjs', priority: 20 },
    framerMotion:   { test: /[\\/]node_modules[\\/](framer-motion|popmotion|framesync|style-value-types|hey-listen|@motionone|motionone)[\\/]/, name: 'vendor-framer-motion', priority: 20 },
    materialTW:     { test: /[\\/]node_modules[\\/](@material-tailwind|@floating-ui)[\\/]/, name: 'vendor-material-tailwind', priority: 20 },
    xyflow:         { test: /[\\/]node_modules[\\/](@xyflow|d3-)[\\/]/, name: 'vendor-xyflow', priority: 20 },
    gridstack:      { test: /[\\/]node_modules[\\/]gridstack[\\/]/, name: 'vendor-gridstack', priority: 20 },
    virtuoso:       { test: /[\\/]node_modules[\\/]react-virtuoso[\\/]/, name: 'vendor-virtuoso', priority: 20 },
    stateLibs:      { test: /[\\/]node_modules[\\/](swr|zustand)[\\/]/, name: 'vendor-state', priority: 20 },
  },
}
```

注意：`per-package` 会把未命名的依赖也各自成 chunk（与现「每包一个 vendor-*」对齐但命名
前缀不同）；大 chunk（elkjs / shikijs-langs / shikijs-themes / oniguruma）需确认保持独立与否。
**产出与 Vite 不追求逐字节一致**，以「关键页首屏体积与请求数不劣化 + e2e @p0 绿」为验收。

## 4. 测试栈决策（Phase 2 决策门，research.md §4）

- **Phase 1** 一律方案 A（保留 Vitest）：`vite.config.ts` 瘦身为测试配置（仅 react 插件 + alias
  - test 块），vite 留 devDeps。
- **Phase 2**（独立决策）：方案 B（Rstest）执行清单见 research.md §4；
  必须项：81 文件 codemod、setupTests import、`@rstest/core/globals` 类型、`core_suite.mjs` 换
  runner、`labDemoMode.test.ts` 3 用例改写（`import.meta.env.DEV` 编译期化）。

## 5. 迁移 + 回滚边界（AGENTS.md 硬性要求）

- **迁移**：Phase 1 内逐项平移（§1.1 表），每项后跑对应 seam（§7）；全绿后才进入 Phase 2。
- **回滚**：Phase 1 完成时 `vite.config.ts` 仅瘦身不删除、`vite`/`@vitejs/plugin-react` 保留在
  devDeps；回滚 = 恢复 `vite.config.ts` 全文 + package.json scripts 指回 `vite`，一次 commit 可逆。
- **删除旧物**：仅在 Phase 2 决策为 B 且全绿后，移除 `vite`/`@vitejs/plugin-react`/`vite.config.ts`
  （tsconfig.node.json 同步）；选 A 时永久保留。
- B1 补丁（NMF）与上游修复二选一，不并存两份。

## 6. 风险登记

| 风险                                                                          | 等级 | 缓解                                                            |
| ----------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| B1 补丁是模块替换，若 pptxgenjs Node 分支被意外触发（未来版本改动）行为不确定 | 中   | 先查上游修复；补丁加注释 + 回归「导出 pptx + 导出 pdf」两条 E2E |
| 分包重写导致首屏体积/请求数劣化                                               | 中   | §3 验收标准：关键页首屏不劣化；`rsbuild inspect` 核对           |
| dev HMR chunk 级热更，迭代体验降级                                            | 低   | 接受；文档记录差异                                              |
| Rstest 迁移（Phase 2）中 `import.meta.env.*` 编译期化等隐性差异               | 中   | PoC 已定位 1 处（labDemoMode）；迁移时先跑全量 diff             |
| 两套 bundler 并存期依赖解析漂移（Vite 视角 vs Rspack 视角）                   | 低   | Phase 1 只动构建层；Vitest 配置与 rsbuild 配置各自独立别名      |

## 7. 测试 seam（复用既有 harness，无新 seam；apply 前与用户确认）

- `bun run build`（apps/web 构建出 dist）
- `bun run dev:web`（dev 起服无错）
- `bun run test:ci`（web Vitest 81 文件全绿）
- `just e2e`（Playwright @p0）
- `bun typecheck`
- 浏览器冒烟（复用 e2e 系统 Chrome + fixtures）：渲染 + console 0 error + 代理连通
