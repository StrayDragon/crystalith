## Why

当前仓库的质量门槛已经建立了可运行的 `ruff` / `oxlint` 基线，但仍存在一些“低噪音高收益”的问题类型没有被持续拦截：例如 Python 内置名遮蔽、生产代码中的未使用参数、naive datetime，以及前端一些明显可疑/低性能写法。随着代码量增长，这些问题会逐步积累成可维护性与回归风险。

本变更目标是在不引入“风格大战”与大规模重写的前提下，进一步收紧质量门槛：只开启信噪比高、可自动/半自动修复的规则集，并对测试代码保留必要的宽松度。

## What Changes

- Backend：在 `backend/py` 的 Ruff 基线之上扩展低噪音规则集（`A` / `ARG` / `DTZ`），并对所有 `**/tests/**` 目录放宽 `ARG*`（未使用参数）以适配 pytest fixture/参数化写法。
- Frontend：在 `oxlint` 的增量与全量入口中启用 `suspicious` + `perf` 类别（保持默认 correctness），并显式放行 `react-in-jsx-scope`（React 17+ / 19 新 JSX transform 下该规则属于过时约束）。
- Specs：更新/补充 `quality-and-regression` 中关于 lint 门槛与增量引入策略的要求，使其与当前仓库执行方式一致。

## Capabilities

### New Capabilities

<!-- 本变更不引入新的 capability -->

### Modified Capabilities

- `quality-and-regression`: 明确 lint 的“低噪音增量升级”策略（基线清零后再收紧 gate），并规定前后端 lint 入口对新规则集的覆盖范围与测试例外边界。

## Impact

- 实际影响范围（按实现提交统计）：
  - Backend：33 个文件（含 Ruff 配置与生产/测试代码修复）。
  - Frontend：30 个文件（含 lint 入口与基线修复；启用 `suspicious+perf` 时，基线初始为 67 errors / 28 files）。
- 变更类型以静态检查与小幅代码调整为主，不预期影响运行时语义；风险主要来自少量规则带来的重构成本（例如 `no-await-in-loop`、`no-array-index-key`），已通过局部重构或带理由的最小范围 disable 处理。
