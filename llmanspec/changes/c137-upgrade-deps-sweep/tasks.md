# Tasks — c137-upgrade-deps-sweep

- [ ] T1 固化升级前基线（在 change 分支上测量）：确认 `just qa` 起点绿、记录 web 构建产物体积基线（`apps/web/dist`），作为升级后对比锚点
- [ ] T2 Stage 1 in-range sweep：全工作区 `bun update`（root/server/web/e2e）；`.bun-version` 1.4.2→1.4.3；`apps/web` `packageManager` bun@1.4.0→1.4.3；server `@types/bun` `latest`→`^1.4.3`；`just qa` 全绿 [blocked-by: T1]
- [ ] T3 Stage 2 统一 zod-to-openapi 9.1：shared 8.5→9.1 对齐 server，梳理 `zod-extend.ts` 双 extend 关系；验证 `/openapi.json` 生成面与 `check-app-schema` 门禁输出等价 [blocked-by: T2]
- [ ] T4 Stage 2 `@streamdown/code` 1.1.1→2.0.0（Shiki v4）适配：唯一消费点 AssistantMarkdown；Rstest + e2e 视觉点检代码块高亮等价（streamdown 2.7 已随 T2） [blocked-by: T3]
- [ ] T5 Stage 2 `@testing-library/jest-dom` 6→7.0.1：确认 `@testing-library/dom` 直接依赖在位；web Rstest 全绿 [blocked-by: T4]
- [ ] T6 Stage 2 `@rstest/core` + `@rstest/adapter-rsbuild` 0.11.12→0.12.3：适配 JS API/reporter 破坏（重点 `core_suite.mjs`）；`test:ci` 与 `test:core` 双编排全绿 [blocked-by: T5]
- [ ] T7 Stage 2 `@cucumber/gherkin` 41→42：`just test-bdd` 全绿 [blocked-by: T6]
- [ ] T8 Stage 2 `@types/node`（web+e2e）22→26：`bun typecheck` 全绿（types-only，冲突则二分降级） [blocked-by: T7]
- [ ] T9 Stage 3 React 19 安装面：撤根 `resolutions`；react/react-dom 19.3.1；`@types/react`/`@types/react-dom` 19；`@emotion/*` →11.14；按 D6 处理安装期 peer 冲突 [blocked-by: T8]
- [ ] T10 Stage 3 React 19 编译/运行时适配清偿：useRef 初值、ReactNode/JSX namespace 等类型错误与运行时告警清零（按 D2 不做 forwardRef 全量迁移）；`bun typecheck` + `just qa` 绿 [blocked-by: T9]
- [ ] T11 Stage 3 React 19 全量回归：`just qa` + `e2e:all` 全绿 + 视觉点检（工作台 / Research Lab / demo 三面） [blocked-by: T10]
- [ ] T12 Stage 4 升级报告与文档同步：逐项版本矩阵、降级台账（若有）、`AGENTS.md` "React 18.2.0 locked" 条目改写、`docs/known-issues.md` 增删、体积对比结论 [blocked-by: T11]
