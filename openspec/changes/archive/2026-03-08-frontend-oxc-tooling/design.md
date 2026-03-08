## Context

`frontend/web` 目前依赖 `Biome` 进行 lint，但 `biome.json` 中 formatter 被显式关闭，因此仓库没有稳定的前端格式化入口。现有 `pnpm run lint` 借助 Biome 的 VCS changed-files 机制提供增量检查，而 `lint:all` 在当前规则集下会对历史代码报出大量诊断，难以成为可持续的全量校验入口。

Oxc 目前已同时提供 `oxlint` 与 `oxfmt`。对本仓库而言，核心约束是：
- 保持前端日常 lint 足够快，不能退化成每次全量扫描。
- 引入 formatter 后要避免触碰生成产物（如 `src/api/generated`、`openapi.json`）与 vendor 内容。
- 迁移应尽量只改变工具链，不顺手修复大量既有业务代码问题。

## Goals / Non-Goals

**Goals:**
- 将 `frontend/web` 的 lint 入口迁移到 `oxlint`。
- 为前端新增正式的 `oxfmt` 格式化命令与检查命令。
- 保留 `pnpm run lint` 的增量语义，并在没有可比较基线时提供稳健回退。
- 通过一次全量格式化，让后续变更基于统一风格继续开发。
- 更新开发文档与 OpenSpec 上下文，避免“文档说 Biome、实际用 Oxc”的漂移。

**Non-Goals:**
- 不修改后端或 monorepo 其他 JS/TS 子项目的工具链。
- 不启用 type-aware linting，也不借机处理大量历史 warning。
- 不把这次迁移扩展为 editor/IDE 仓库配置改造。

## Decisions

### 1. 使用独立增量 lint helper 维持 `pnpm run lint` 体验

`oxlint` 本身没有等价于 `biome lint --changed` 的内建 VCS 模式，因此新增一个轻量 Node helper：
- 默认对比 `origin/main...HEAD` 的改动文件。
- 若本地没有 `origin/main`，回退到 `git diff HEAD`，同时纳入未跟踪文件。
- 仅把 `src/**/*.ts(x)/js(x)` 中的手写源码传给 `oxlint`，并排除 `src/api/generated/**`。

选择 Node helper 而不是 bash one-liner，是为了：
- 在仓库内保留可测试的筛选逻辑。
- 减少复杂 shell 管道在不同环境下的脆弱性。

### 2. `oxlint` 采用插件启用、warning 友好、error 保守的策略

`.oxlintrc.json` 启用与当前前端最相关的插件：`react`、`import`、`vitest`、`jsx-a11y`，并保留 Oxc 默认的 `typescript` / `unicorn` / `oxc` 插件。

迁移首轮不主动把 warning 提升为失败条件：
- 这样 `lint:all` 可作为可运行的全量反馈入口，而无需同步修复大量历史问题。
- 真正的 correctness 级问题仍保留由 Oxc 默认 error 语义拦截。

### 3. `oxfmt` 仅格式化手写前端代码与关键配置

格式化入口覆盖：
- `src/**/*.{ts,tsx,js,jsx,css}`
- `package.json`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `.oxlintrc.json`
- `.oxfmtrc.json`

不把 `openapi.json`、`src/api/generated/**`、`pnpm-lock.yaml`、`vendor/**` 纳入 `oxfmt`，避免对生成文件或第三方内容制造噪声。

### 4. 立即执行一次全量格式化收敛

既然仓库将正式引入 `oxfmt`，就立即对受管前端代码与配置执行一次全量格式化，后续再通过 `format:check` 保持稳定。

## Risks / Trade-offs

- `[风险] Oxfmt 仍在快速演进` → 使用当前稳定 npm 版本，并把配置保持最小化，减少后续升级摩擦。
- `[风险] 全量格式化会扩大 diff` → 只格式化手写代码与关键配置，不碰生成物与 lock/vendor 文件。
- `[风险] 本地分支缺少 origin/main 时增量 lint 失效` → helper 自动回退到 `git diff HEAD` + 未跟踪文件。
- `[风险] Oxc warning 数量较多` → 首轮迁移以“可运行、可采纳”的工作流为主，不把 warning 升为失败条件。

## Migration Plan

1. 创建 OpenSpec change 并补齐 proposal/design/spec/tasks。
2. 在 `frontend/web` 增加 Oxc 配置与增量 lint helper，替换 `Biome` 依赖和脚本。
3. 执行一次 `oxfmt` 全量格式化。
4. 更新文档与 OpenSpec 上下文。
5. 运行 lint / format:check / typecheck / test / build 验证，并回填 `tasks.md`。

## Open Questions

- 本次迁移不保留 `Biome` 兼容入口；若后续团队希望在 CI 中把 Oxc warnings 提升为失败条件，可在独立 change 中推进。
