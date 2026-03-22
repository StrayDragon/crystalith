## Why

“慢”这类问题，最怕只剩一句话：我感觉它很慢。我们已经有诊断包导出（`c2126`）和前端性能度量（`c2013`）。但当需要定位具体卡点时，少一个 trace/录制就会回到原始时代：反复让人截图、反复让人试命令。

这份 change 不做复杂平台化，它只做一件事：让诊断包在需要时能带上**性能证据**，并且默认安全、默认克制。

## What Changes

- 扩展 diagnostics export pack（在 `c2126` 基础上加可选附件）：
  - Web Vitals/marks 快照（LCP/INP/CLS + workspace marks）
  - 可选：Playwright trace 或浏览器性能录制（仅 dev/local，且用户显式点击才采集）
  - 可选：React profiler summary（只要摘要，不要全量事件洪水）
  - 可选：最近一次 run 的 timings（引用 `c2136` 的字段）
- 加红线与预算：
  - 默认不包含 source 原文/消息正文，只包含 ID、长度、哈希或摘要
  - 限制包大小，超过则提示用户“只导出摘要版”
- 文档联动：
  - Troubleshooting Hub（`c248`）里把“如何导出性能诊断包”写成固定步骤

## Capabilities

### New Capabilities

- `diagnostics-export-pack-with-perf-traces`: 性能附件的格式、采集边界与脱敏规则。

### Modified Capabilities

- `diagnostics-export-pack`（`c2126`）：扩展包结构但保持向后兼容（旧 reader 仍能读核心文件）。
- `frontend-performance-marks-and-web-vitals-gates`（`c2013`）：提供稳定的指标导出格式。
- `dev-diagnostics-workbench`（`c30`）：可选，把“导出 perf pack”作为 diagnostics 的一键动作。
- `docs-troubleshooting-hub-and-debug-recipes`（`c248`）：文档给出明确可执行步骤。

## Impact

- UX：用户反馈“慢”时，能把证据一次带走，减少来回扯皮。
- Engineering：定位效率提升很明显，尤其是渲染抖动和事件风暴这类问题。

```mermaid
flowchart TD
  UI[DiagnosticsDialog] --> BASE[Base pack (c2126)]
  UI --> OPT{Collect perf?}
  OPT -->|no| ZIP1[Export zip]
  OPT -->|yes| PERF[Traces + vitals + marks]
  PERF --> RED[Redaction + size budget]
  RED --> ZIP2[Export zip]
```
