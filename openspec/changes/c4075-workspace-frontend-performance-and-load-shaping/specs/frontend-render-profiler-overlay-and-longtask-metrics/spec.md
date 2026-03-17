# frontend-render-profiler-overlay-and-longtask-metrics 规范增量

## ADDED Requirements

### Requirement: Dev Profiler Overlay MUST Expose Non-content Performance Signals Only
系统 MUST 提供 dev-only profiler overlay，但只暴露计数、耗时和摘要，不采集用户正文内容。

#### Scenario: 开发者打开 perf overlay
- **WHEN** 开发者在本地启用 profiler overlay
- **THEN** overlay SHALL 展示 render count、long task、关键 marks 或等价摘要
- **AND** SHALL 不记录或导出用户正文内容

### Requirement: Overlay Summaries MUST Be Exportable for Diagnostics
系统 MUST 允许将 perf overlay 摘要导出为轻量可分享格式，便于复现与排查。

#### Scenario: 开发者复制性能摘要
- **WHEN** 开发者从 overlay 触发复制或导出
- **THEN** 系统 SHALL 生成稳定的文本或 JSON 摘要
- **AND** 该摘要 SHALL 可作为 issue 或 diagnostics 附件使用
