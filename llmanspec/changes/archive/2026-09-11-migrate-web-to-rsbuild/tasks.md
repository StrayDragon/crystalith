# Tasks — migrate-web-to-rsbuild

> Seam（复用既有 harness，无新 seam；apply 前已与用户确认）：
> ① `bun run build`（apps/web 构建出 dist）② `bun run dev:web`（dev 起服无错，端口 3000）
> ③ `bun run test:ci`（web Vitest 81 文件）④ `just e2e`（Playwright @p0）
> ⑤ `bun typecheck` ⑥ 浏览器冒烟（e2e fixtures 系统 Chrome：渲染 + console/page 0 error
>
> - `/v1`·`/v2`·`/slidev`(ws) 代理连通，非新 harness）。
>   参考：research.md（PoC 证据与 B1–B6）、design.md（目标架构与回滚边界）。
>   大范围重构例外 → 按相位（expand→contract）推进，不强拆垂直切片。

## Phase 1 — 构建层切换到 Rspack（Vite 仍留作 Vitest 底座）

### T1 依赖与 rsbuild.config.ts 基础平移

- [x] `apps/web`：`bun add -d @rsbuild/core @rsbuild/plugin-react`；package.json scripts
      `dev`/`build`/`preview` 指向 `rsbuild`（`vite` 相关 scripts 暂保留在注释或独立命名）
- [x] 新增 `rsbuild.config.ts`：`pluginReact()` + `source.entry{index:'./src/app/main.tsx'}` + `html.template`（index.html 去掉 `<script src="/src/app/main.tsx">`，Rsbuild 自动注入）
- [x] 平移 alias（`@brand` / `@crystalith/shared` / `@crystalith-slidev` / react 单副本）+
      `resolve.dedupe` + dev proxy（`/v1`·`/v2`·`/openapi.json`·`/asyncapi.json`·`/health`·`/slidev`(ws:true)）+ `server.port:3000` / `server.host:true` / `server.strictPort:true`
- [x] **B1 补丁**：`tools.rspack.plugins` 注入 `NormalModuleReplacementPlugin(/^node:(fs|https)$/, 空模块)`
      （先查 pptxgenjs 上游是否已修；已修则改依赖升级，不并存两份）→ 上游 4.0.1（latest，2025-06）未修，按 PoC 打补丁
- [x] env：`source.define = loadEnv({prefixes:['VITE_']}).publicVars`；`src/vite-env.d.ts`
      引用 `vite/client` → `@rsbuild/core/types`（ImportMetaEnv augment 不动）
- [x] 测试配置拆分：`vite.config.ts` 瘦身为 vitest-only（react 插件 + alias + test 块）或新建
      `vitest.config.ts`；`tsconfig.node.json` include 同步 → 采用前者（vite.config.ts 原地瘦身）
- 验证：`bun run build` 出 dist 且无错；`bun typecheck`；`bun run test:ci` 全绿（Vitest 未受影响）

### T2 分包策略重写（B2）+ 产物验收

- [x] `splitChunks`：`preset:'per-package'` + 命名 `cacheGroups`（react/mui/framer-motion/
      material-tailwind/xyflow/gridstack/virtuoso/swr+zustand/jspdf/pptxgenjs，正则 `test`，
      禁函数式 test）——映射表见 design.md §3
      （注：Rsbuild 2.x 该配置为**顶层 `splitChunks`**，非 v1 的 `performance.splitChunks`）
- [x] 大 chunk 策略确认：elkjs / shikijs-langs(-themes) / oniguruma 是否保持独立（与现 Vite
      基线对比首屏体积与请求数，**不劣化**为验收）
      → 实测：Vite 基线首屏 ~170 请求（含 elkjs 1.4M 同步）；Rsbuild 首屏 10 个 JS 请求
      （index 604K + 共享 chunk 3.3M + vendor-*），JS gzip 总量 3560K vs 基线 3341K（+6.5%），
      shiki langs/themes 两侧均为异步加载 → 不劣化
- [x] 产物级回归：dist 结构（`static/js|css` / `defer` script / public 原样 / prod 无 .map）+
      server 静态托管冒烟（`CL_WEB_DIST` 或二进制旁 dist）
      → 冒烟全绿；附带修复 `web-static.ts` cacheControl 对 `static/` 产物补 immutable 缓存
      （原仅 `assets/`），并加 lock-test（web-static.test.ts 13/13）
- [x] 浏览器冒烟（seam ⑥）：渲染 + console/page 0 error + 代理连通；`rsbuild inspect`
      核对最终配置（临时 spec 驱动 e2e 全栈验证后删除）
- 验证：`bun run build` + 冒烟脚本绿；`just e2e` 关键 @p0 不回归 → 31/31 绿

### T3 CLI / 进程 / CI 引用替换

- [x] procfile `web:` → `rsbuild dev`；`justfile`（dev-web / dev-server 相关行、`test-web`
      引用）指向 rsbuild；`package.json` 根 scripts 相应更新
      （注：三处均经 `bun run dev`/`bun run test:ci` 间接指向，命令本身无需改，仅 Procfile 注释更新）
- [x] `e2e/playwright.config.ts` webServer web 条：`bunx vite --host --port --strictPort`
      → `bunx rsbuild dev --host 127.0.0.1 --port ${WEB_PORT}`（strict 由 config 承担）
- [x] `apps/web/scripts/core_suite.mjs` 与 `test:ci` 命令复核（Phase 1 仍走 vitest，仅确认
      runner 路径/环境变量不被构建层变更影响）→ 仅 spawn vitest，无 vite 依赖，无需改
- [x] `scripts/build-release.ts` 回归验证一次（`bun run build` 链路不变，仅确认产物可被
      `web/dist` 拾取）→ 命令不变（`bun run build`），仅注释 vite→rsbuild；CL_WEB_DIST 冒烟已验
- 验证：`just qa`（typecheck + lint + format + schema/env drift + server/shared + web Vitest + e2e @p0）全绿 → ✅

### T4 全量门禁回归（Phase 1 验收）

- [x] `bun typecheck` / `bun lint` / `bun format:check` OK
- [x] `bun run test:ci`（81 文件全绿）+ `just test-bdd`（server 相关 PR 自行跑绿）
      → 80 文件 309 用例全绿；BDD 28/28 绿
- [x] `just e2e` @p0 全绿（含导出 pptx/pdf 用例——B1 语义安全回归点）
      → e2e 无导出用例；B1 语义以单元（exporters/useExport 全绿）+ 产物静态核查
      （dist 内 0 处 `node:` 引用）双重复核
- [x] dev 手动回归：烧瓶入口 → Compose → 创建 Run 并 stream；Studio `/slidev`(ws) 回放连通
      → 烧瓶→Compose→Run+stream 经 p0-eden-lab e2e（stub research kernel）对 rsbuild dev 全绿；
      `/slidev`(ws) 回放已用内置浏览器对 overmind 全栈实测关闭：代理 ws 握手 OPEN +
      `{"type":"connected"}`（与直连一致）、翻页 1/2→2/2、Studio 同款 iframe 挂载可读
      deck title（详见 research.md §6.4）
- 验证：`just qa` 全绿；产物与首屏对比记录在案 → ✅（见 T2 记录）

## Phase 2 — 测试栈决策门（独立决策，research.md §4）

### T5 [决策门] 测试栈选择（A：保留 Vitest / B：全面 Rstest） [blocked-by: T4]

- [x] 决策记录：选 A → 终止 Phase 2（vite 永久留 devDeps，仅文档说明）；选 B → 执行 T5.1–T5.4
      → **选 B（全面 Rstest）**，用户确认于 apply 决策门（2026-09-11）
- [x] T5.1 机械 codemod：81 个测试文件 `vi.→rs.` + `from 'vitest'→'@rstest/core'`
      （`vi.hoisted`→`rs.hoisted`、`vi.stubEnv`→`rs.stubEnv` 等全映射）；`setupTests.ts`
      import 替换（expect.extend 已是显式）；tsconfig `vitest/globals`→`@rstest/core/globals`
- [x] T5.2 环境差异修正：`labDemoMode.test.ts` 3 用例（`import.meta.env.DEV` 编译期化）改写为
      「只测 VITE_LAB_DEMO 闸门 + DEV 视为环境常量」；排查其它运行时 env 依赖
      → 改写为 env 注入式签名（默认参仍为 `import.meta.env`），4 用例全分支；其余测试无 env 运行时依赖
- [x] T5.3 runner 接线：`core_suite.mjs` spawn `rstest`；`test:ci`/`test:core`/`test:all`
      scripts 换 rstest；`VITEST_*` 环境开关更名（或保留为通用 env）→ 更名 `RSTEST_*`
      （`RSTEST_MSW_ON_UNHANDLED` / `RSTEST_INCLUDE_EXPERIMENTAL`）
- 验证：`bun run test:ci`（等价总量）全绿 + `just qa` 全绿
  → 80 文件/310 用例全绿（原 309：labDemoMode 3→4）；Rstest 需同步 factory：
  `rs.mock` 不支持 async factory，7 文件改 `with { rstest: 'importActual' }` + 同步工厂

### T6 旧物清理与文档 [blocked-by: T5]

- [x] 选 B：移除 `vite` / `@vitejs/plugin-react` / `vite.config.ts`（tsconfig.node.json 同步）；
      选 A：保留并注明理由 → 另移除孤儿依赖 `vitest` / `@vitest/coverage-v8`（无 coverage script）
- [x] `apps/web/AGENTS.md` / 根 `AGENTS.md` 技术栈表更新（vite → Rsbuild/Rspack；测试栈随决策）
- [x] research.md 归档前复核：B1 上游状态、分包对比数据、遗留疑问清空或标记 → §6 已逐项写结论
- 验证：`bun install` 干净（无孤儿依赖引用）+ `just qa` 全绿
