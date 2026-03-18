# regression-failure-triage-bundles-and-shareable-reports 规范增量

## ADDED Requirements

### Requirement: Regression Failures MUST Be Exportable as Triage Bundles
系统 MUST 支持将一次回归失败导出为 triage bundle，而不是让现场只存在于临时日志里。

#### Scenario: CI 或本地回归失败
- **WHEN** 某次 regression、replay 或 eval 运行失败
- **THEN** 系统 SHALL 能生成包含关键上下文、快照与日志摘要的 triage bundle
- **AND** SHALL 支持后续重放与协作排查

### Requirement: Shareable Reports MUST Reuse Provenance and Replay Context
系统 MUST 让 shareable reports 复用 provenance 和 replay substrate，而不是为报告单独再组装一套上下文。

#### Scenario: 用户准备把一次失败报告分享给他人
- **WHEN** 用户导出 shareable report
- **THEN** 报告 SHALL 能链接到对应 provenance、repro pack 或 replay diff
- **AND** SHALL 清楚区分临时排查包与长期问题记录
