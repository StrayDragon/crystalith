# Design — c137 周期性依赖升级 sweep

## D1 单 change 全量 + 阶段化 task 边界 = 二分粒度

用户明确要求单一 change 吃下全部推荐升级、失败二分定位降级。落地方式：

- task 按「一个可独立回退的升级簇」切分（in-range sweep / 每个小 major 各一 task / React 19 拆安装面+编译适配+回归三 task）。
- 每 task 完成即跑 `just qa`，绿才勾；红则**在该 task 的包集合内**二分（先回退最可疑单包至前一版本，收窄到确因子的包），降级项连同原因与证据记入台账（proposal 报告的一部分）。
- Stage 1 → Stage 2 → Stage 3 顺序推进：低风险先行，React 19 最后，避免高风险项污染前置 stage 的归因。
- 该 stage/task 结构即未来周期性 deps sweep 的模板。

## D2 React 19 适配范围收敛：只清错误，不做 forwardRef 全量迁移

React 19 中 `forwardRef` 仍可用（仅 deprecation 方向）；`useRef()` 无初值等类型变化、`ReactNode` 含 `Promise`、JSX namespace 迁移是**必须**清偿的编译错误面。本 change 的目标是**解锁版本**而非顺带重构：forwardRef 清理、React Compiler 评估等留给后续独立 refactor/quick。验收口径 = typecheck 零错误 + 运行时无新告警 + e2e 全绿。

## D3 zod-to-openapi 统一 9.1 的等价判据

现状是 shared 8.5 与 server 9.1 两个 major 同时 `extendZodWithOpenApi` patch 同一 zod 原型，靠两版内部元数据约定巧合兼容。统一到 9.1 后判据：`/openapi.json` 生成面（server `openapi.ts` + `registerApiDoc` 全量路由）与 `config/app.schema.gen.json` 门禁输出不变（忽略纯版本号字段）。

## D4 rstest 0.12 全家同步 + 双编排验证

官方要求 `@rstest/*` 全部包一致升 0.12（`@rstest/core` + `@rstest/adapter-rsbuild`）。破坏面在 JS API 与 reporter types：本仓自定义 `apps/web/scripts/core_suite.mjs` 编排是重点适配对象。验证 = `test:ci`（rstest run）与 `test:core`（node core_suite）双编排全绿。

## D5 @types/bun `latest` 收紧为 `^1.4.3`

`"latest"` 声明面不可复现（lockfile 虽钉住但 fresh resolve 漂移）。收紧为 `^1.4.3` 与 Bun 运行时当前线对齐；后续周期 sweep 随 `.bun-version` 一起动。

## D6 React 19 安装期 peer 兼容预期

- MUI 9.5：v9 基线即 React 19（同时支持 18）。
- `@emotion/react`/`@emotion/styled` 升至 11.14（peer `react >=16.8`，React 19 兼容线）。
- 其余（radix / xyflow 12 / platejs 53 / swr / zustand / msw / react-virtuoso / gridstack / `@testing-library/react` 16.3）peer 面均覆盖 19。
- 若出现安装期 peer 冲突：优先升包内可升项；确不可解的用**最小化、带注释与台账记录的 override**，禁止宽泛 override。

## D7 不动项清单（审计结论固化）

elysia 1.4.30 / @elysiajs eden 1.4.9 + openapi 1.4.16 / drizzle-orm 0.45.4 / drizzle-kit 0.31.11 / zod 4.6.7 / @mui/* 9.5.0 / msw 3.0.3 / @xyflow/react 12.12.0 / tailwindcss 4.3.3 / typescript 7.0.2 / oxlint-tsgolint 7.0.2004 / platejs 53.3.15 / fallow 3.33.1 / Bun 1.4.3——npm registry 核实均为 latest，本 change 不触碰。fallow 的 tw4 css-first 检测缺口继续等上游（known-issues 台账已有条目）。

## 成功判据

1. 每 stage 后 `just qa` 全绿（typecheck + lint + format + 漂移门禁 + server/shared 单测 + web Rstest + e2e @p0）。
2. React 19 stage 额外 `e2e:all` 全绿；gherkin 42 task 后 `just test-bdd` 绿。
3. 降级台账为零，或每项有「失败证据 + 二分定位过程 + 重试条件」。
4. `AGENTS.md` React locked 条目与实际一致；无未同步的文档状态声明。
