## Why

“UI 卡”很多时候不是网络慢，而是渲染和主线程忙：重复 re-render、长任务、事件风暴。Web Vitals 能告诉你“卡了”，但不告诉你“卡在哪里”。如果每次都要开 DevTools、手动录制 profile，门槛太高，最后大家就会放弃定位，转而用“少改点吧”自我安慰。

这份 change 做一个 dev-friendly 的小工具：一个随时可开关的 overlay，让你在 workspace 里直接看到渲染压力和长任务，做到“边用边抓”。

## What Changes

- 增加 dev-only perf overlay（默认关闭，可通过快捷键/设置打开）：
  - render commit 频率与近 10s 的峰值
  - long task 计数与总时长（PerformanceObserver）
  - 关键 marks（workspace shell ready、panel ready、SSE 首事件/首 token，对齐 `c2013`）
  - 可选：React profiler 摘要（top components by render count/time，仅摘要）
- 给一个“复制摘要”入口：
  - 复制为一段短 JSON/文本，可直接贴 issue
  - 并可作为 `c2142` 的 perf 附件来源之一
- 明确红线：
  - overlay 不采集内容正文，不记录用户数据；只做计数与耗时摘要

## Capabilities

### New Capabilities

- `frontend-render-profiler-overlay-and-longtask-metrics`: overlay 指标集合、开关与导出格式。

### Modified Capabilities

- `frontend-performance-marks-and-web-vitals-gates`（`c2013`）：marks 的命名与采集点需要更稳定，便于 overlay 展示。
- `dev-diagnostics-workbench`（`c30`）：可选，把 overlay 的摘要也汇入 diagnostics 页面。
- `diagnostics-export-pack-with-perf-traces`（`c2142`）：overlay 摘要成为“轻量 perf 证据”。

## Impact

- DX：性能问题的定位成本大幅下降，尤其适合在重构期做快速自检。
- Risk：overlay 容易变成“到处都在看数字”；v1 要克制，只展示最关键的 6~10 个指标。

```mermaid
flowchart LR
  OBS[PerformanceObserver] --> OVR[Perf overlay]
  MARK[Perf marks] --> OVR
  REACT[React profiler (summary)] --> OVR
  OVR --> COPY[Copy summary]
  COPY --> PACK[Diagnostics export pack]
```
