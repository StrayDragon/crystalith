# browser-clipper-and-web-capture 规范增量

## ADDED Requirements

### Requirement: Browser Capture MUST Produce a Normalized Capture Envelope
系统 MUST 让浏览器整页、选区、截图和快速保存都产出统一 capture envelope，而不是按入口类型分别定义不兼容对象。

#### Scenario: 用户从浏览器扩展保存一个网页选区
- **WHEN** 用户在 browser clipper 中保存整页、选区或截图
- **THEN** 系统 SHALL 记录 capture mode、origin URL、capture timestamp 和最小 provenance 摘要
- **AND** SHALL 以统一 capture envelope 写入后续 ingest / queue 流程

### Requirement: Browser Capture MUST Support Deferred Landing Without Losing Traceability
系统 MUST 支持浏览器采集先进入 inbox、draft 或当前 notebook，再在稍后完成正式落地，同时保留可追溯 metadata。

#### Scenario: 用户先保存后整理
- **WHEN** 用户在浏览器中快速保存某个 capture 但未当场完成整理
- **THEN** 系统 SHALL 允许该 capture 先进入待整理队列
- **AND** 后续正式落地为 source 或 notebook object 时 SHALL 保留其 capture metadata
