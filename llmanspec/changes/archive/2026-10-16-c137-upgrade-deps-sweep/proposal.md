---
depends_on: []
needs_specs_change: false
title: 周期性依赖升级 sweep——单 change 一轮完成全部推荐升级（in-range 清扫 + 六个小 major + React 19 解锁）
branch: sdd/c137-upgrade-deps-sweep
base_branch: main
base_sha: a4d0b4dd90d0ad1a5c6c75aa256629987d56b76c
---

## Why

依赖审计（2026-10-16）结论：大盘健康（elysia/drizzle/zod/MUI/msw/xyflow/tailwindcss/TS7/fallow/Bun 1.4.3 均已最新），但沉淀了三类升级债：

1. **in-range 未刷新**：`ai` + 6 个 `@ai-sdk/*`、`streamdown` 2.7（流式代码块只高亮新增行）、swr/zustand/radix/rsbuild 等全被现有 `^` range 覆盖，只是 lockfile 未刷新；另有 CI `.bun-version` 1.4.2 与本地 1.4.3、`apps/web` `packageManager: bun@1.4.0` 的钉子漂移。
2. **六个小 major 欠账**：shared 的 `@asteasolutions/zod-to-openapi` 8.5 与 server 的 9.1 **双 major 同仓共存**，两者各自 `extendZodWithOpenApi` patch 同一个 zod 原型（隐性债）；`@streamdown/code` 1→2（Shiki v4）；`@testing-library/jest-dom` 6→7；`@rstest/*` 0.11→0.12（0.11 本就是 1.0 前 settling 版）；`@cucumber/gherkin` 41→42；`@types/node` 22→26。
3. **React 18.2.0 刻意锁死**而生态位已成熟：MUI v9 基线即 React 19（2026-04），`@emotion` 11.14 peer `>=16.8`，`@testing-library/react` 16.3 / radix / xyflow 12 / platejs 53 / swr / zustand / msw 3 全部就绪。

用户决策：不拆多 PR，**全部纳入本单一 change**、阶段化推进、完成后出报告；遇到问题用**二分法定位到包级再降级**并记台账。本 change 同时作为后续周期性 deps sweep 的模板（stage/task 边界即二分粒度）。

## What Changes

- **Stage 1 — in-range sweep**：`bun update` 全工作区（root/server/web/e2e）；`.bun-version` 1.4.2→1.4.3；`apps/web` `packageManager` bun@1.4.0→1.4.3；server `@types/bun` `latest`→`^1.4.3` 收紧（可复现性）。
- **Stage 2 — 六个小 major**（每项独立 task，独立可降级）：
  - `@asteasolutions/zod-to-openapi`（shared）8.5→9.1，对齐 server，消除双 major 原型 patch；
  - `@streamdown/code` 1.1.1→2.0.0（Shiki v4 + Node≥20，配套 streamdown 2.7 已随 Stage 1）；
  - `@testing-library/jest-dom` 6→7.0.1（`@testing-library/dom` 已是直接依赖）；
  - `@rstest/core` + `@rstest/adapter-rsbuild` 0.11.12→0.12.3（`@rstest/*` 全家同步）；
  - `@cucumber/gherkin` 41→42；
  - `@types/node`（web+e2e）22→26。
- **Stage 3 — React 19 解锁**：撤除根 `resolutions`（react/react-dom 18.2.0）；react/react-dom 19.3.1；`@types/react`/`@types/react-dom` 19；`@emotion/react`+`@emotion/styled` →11.14；只清编译错误/运行时告警，**不做** forwardRef 全量迁移（19 中仍可用）。
- **Stage 4 — 报告与文档同步**：逐项版本矩阵、降级台账（若有：原因+证据+重试条件）、`AGENTS.md` "React 18.2.0 locked" 条目更新、known-issues 增删。
- **回退策略**：每 task 完成即跑 `just qa`；失败在该 task 的包集合内二分（先回退最可疑单包再收窄），确因子的包降级并记入台账。task 边界即二分边界。

## Capabilities

**无 specs 变更**（`needs_specs_change: false`）：依赖升级不触碰行为合约——wire Zod、OpenAPI 路由、SSE 事件、ResearchRun 状态机均不变。唯一用户可见面：AssistantMarkdown 代码块高亮引擎 Shiki v3→v4（视觉等价验证）与流式高亮性能提升（streamdown 2.7）。

## Impact

- **风险面（降序）**：React 19 类型面（`@types/react` 19 的 useRef 初值必填、ReactNode 含 Promise、JSX namespace 迁移）与 e2e 视觉回归；rstest 0.12 的 JS API/reporter 破坏（自定义 `core_suite.mjs` 编排）；jest-dom 7 的 required peer。
- **验证面**：每 stage `just qa` 全绿；React 19 stage 额外 `e2e:all`；BDD（`just test-bdd`）随 gherkin 42 task 单独跑绿。
- **不动项**：elysia 1.4.30、drizzle 0.45.4/0.31.11、zod 4.6.7、MUI 9.5.0、msw 3.0.3、`@xyflow/react` 12.12.0、tailwindcss 4.3.3、TS 7.0.2、fallow 3.33.1、Bun 1.4.3——审计时已是最新。

## 结果（2026-10-16 实施收口）

**判定：全部 12 task 完成，零降级**（唯一 e2e:all 失败 S12 为存量债，二分实证与升级无关，见 known-issues 台账）。

### 版本矩阵（关键项）

| 项 | 前 → 后 | 验证 |
|---|---|---|
| React / react-dom / @types | 18.2.0 / 18.3.x → **19.3.1 / 19.3.x**（撤根 resolutions） | typecheck 清零（7 处 `RefObject<T\|null>` 声明适配）；web 442 测试；e2e @p0 ×33 + e2e:all ×34；三面视觉点检（工作台 / /research-lab/1 / /demo/research-lab/1：react-flow 画布、MiniMap、Eden 模型列表全在） |
| @emotion/react + styled | 11.13.5 → 11.14.x | 同上（MUI 9.5 peer 全绿，安装零冲突） |
| @asteasolutions/zod-to-openapi (shared) | 8.5 → **9.1**（与 server 统一） | openapi-generation 测试 + check-app-schema 零漂移；lock 单条 9.1.0 |
| @streamdown/code + streamdown | 1.1.1+2.6 → **2.0.0**+2.7（Shiki v4） | AssistantMarkdown/streamdown-classes 双锁测试绿；消费点 API 面（`code` 导出）不变 |
| @testing-library/jest-dom | 6.10 → **7.0.1** | web 442 绿（required peer @testing-library/dom 已在位） |
| @rstest/core + adapter-rsbuild | 0.11.12 → **0.12.3** | test:ci 442 + test:core 46 双编排绿（纯 config-file 用法免改） |
| @cucumber/gherkin | 41 → **42.0.1** | test-bdd 30 绿 |
| @types/node (web+e2e) | 22 → **26.6.5** | typecheck 绿 |
| in-range 全家（ai/@ai-sdk×6/radix×3/swr/zustand/rsbuild/postcss/oxlint/oxfmt/playwright…） | 见 bun.lock diff | Stage 1/2/3 边界 just qa 三连绿 |
| 钉子对齐 | .bun-version 1.4.2→1.4.3；web packageManager bun@1.4.0→1.4.3；server @types/bun latest→^1.4.3 | bun outdated 全工作区 CLEAN |

### 降级台账

**空**——无任何包需要回退。（e2e:all S12 失败经二分定论为存量债：升级前 main 同签名失败，非依赖因子。）

### 体积对比（apps/web/dist）

raw 16.17 MB → 16.96 MB（**+4.9%**）；gzip 4.14 MB → 4.27 MB（**+3.1%**）。主要贡献 React 19 + Shiki v4 运行时。可接受，未做进一步分包优化（如需可后续独立 change）。
