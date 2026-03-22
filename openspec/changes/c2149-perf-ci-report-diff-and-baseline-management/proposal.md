## Why

性能 gate 最大的敌人不是“没有指标”，而是“指标不可信”：CI 环境抖一下就红，大家很快会把它当噪音关掉。要让 perf 回归检查长期有效，必须有两个东西：

1) **稳定的基线**：同一套场景、同一份夹具、同一份报告 schema（对齐 `c2141`）
2) **可解释的 diff**：这次慢了多少？慢在哪个动作？是否超过阈值？是否可能是环境噪声？

这份 change 负责把 “perf report → diff → baseline” 这一套流程做成仓库惯例。

## What Changes

- 定义 perf report 的稳定 schema（v1 只覆盖关键指标）：
  - marks（shell ready、panel ready、SSE 首事件/首 token）
  - vitals（LCP/INP/CLS）
  - 基准动作耗时（滚动到指定位置、打开详情、启动一次 run）
- 定义 baseline 存放与更新方式：
  - main 分支维护一份 baseline（按 profile/场景分组）
  - PR 里生成 report，与 baseline 做 diff
- 定义判定策略（先 warn 后 gate）：
  - 允许小幅波动（noise band）
  - 超过阈值则输出明确 diff 与建议（例如“列表滚动 INP 退化，检查 `c2133` 的虚拟列表是否失效”）
  - 必要时提供 baseline exceptions（引用 `c1370` 的思想：例外要写清楚）

## Capabilities

### New Capabilities

- `perf-ci-report-diff-and-baseline-management`: report schema、baseline 约定、diff 输出与门禁策略。

### Modified Capabilities

- `perf-regression-benchmarks-and-large-workspace-fixtures`（`c2141`）：benchmarks 必须能产出稳定 report。
- `frontend-performance-marks-and-web-vitals-gates`（`c2013`）/`web-performance-budgets`（`c38`）：指标定义与预算阈值需要一致。
- `quality-and-regression`: perf gate 的执行入口与失败输出格式需要纳入质量门槛体系。

## Impact

- Engineering：性能回归不再靠体感，讨论会更快落到“哪个动作退化了”。
- Risk：如果 baseline 管理太繁琐，会变成负担；v1 先把范围缩到 3~5 个动作，跑通闭环再扩。

```mermaid
flowchart LR
  CI[CI run benchmarks] --> RPT[perf-report.json]
  RPT --> DIFF[Compare to baseline]
  DIFF -->|within band| OK[Pass / warn]
  DIFF -->|regression| FAIL[Fail with diff + hints]
  FAIL --> FIX[Optimize]
  FIX --> UPD[Update baseline (explicit)]
  UPD --> DIFF
```
