## Why

性能回归最讨厌的点在于“事后才知道”。我们已经有 Web Vitals/marks 的方向（`c2013`、`c38`），也有场景夹具与回归 harness（`c520`）。但如果没有一组“足够大、足够稳定”的工作区数据，以及一套能重复跑的 benchmark，性能 gate 很容易变成摆设。

这份提案要做的事很具体：给 Crystalith 一个可复现的大工作区基线，用它来跑关键路径的性能回归。

## What Changes

- 定义 large workspace fixtures（可生成、可回放）：
  - 一个 notebook 内含大量 sources/sessions/outputs（数量级明确，例如 5k sources、1k outputs）
  - 生成过程必须确定性（同 seed 生成同数据），便于对比
- 定义 benchmarks（v1 只覆盖少量关键动作）：
  - 进入 workspace（shell ready、首屏列表 ready）
  - 滚动列表到指定位置（虚拟列表与分页场景）
  - 打开一个 output/source detail（避免重渲染抖动）
  - 启动一次 run 并测 SSE 首事件/首 token（对齐 `c2007`/`c2013`）
- 输出统一报告：
  - JSON 指标 + 可选 trace（由 `c2142` 进一步打包）
  - CI 先 warn 后 gate（遵循 `quality-and-regression` 的风格，别一上来把门槛设成噪音墙）

## Capabilities

### New Capabilities

- `perf-regression-benchmarks-and-large-workspace-fixtures`: 大夹具生成、基准动作集合与报告格式。

### Modified Capabilities

- `workspace-scenario-fixtures-and-regression-harness`（`c520`）：perf fixtures 复用其场景组织方式，避免两套夹具体系。
- `frontend-performance-marks-and-web-vitals-gates`（`c2013`）：marks/vitals 的采集点要能被 benchmark 稳定触发。
- `web-performance-budgets`（`c38`）：预算阈值与报告归因需要对齐。

## Impact

- Engineering：性能优化更像工程，而不是靠体感。
- DX：当某次改动让列表滚动掉帧，你能在 CI 里第一时间看到。

```mermaid
flowchart LR
  GEN[Fixture generator (seeded)] --> DATA[(Large workspace)]
  DATA --> RUN[Benchmark runner]
  RUN --> RPT[Perf report.json]
  RPT --> CI[CI warn/gate]
  CI --> FIX[Optimize + verify]
```
