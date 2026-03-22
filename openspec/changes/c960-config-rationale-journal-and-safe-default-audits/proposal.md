## Why

配置本身并不难看懂，难的是一段时间后没人记得“为什么当初要这么配”。如果没有理由日志和默认值审计，系统会越来越像一堆能跑但说不清缘由的开关。

## What Changes

- 定义 config rationale journal，为关键配置项记录“为什么存在”“什么时候改过”“什么场景下要重审”。
- 增加 safe default audit，定期检查默认值是否还符合当前产品方向和真实使用方式。
- 支持把配置理由与 drift explainer、migration readiness 和 change review 互通。
- 让记录粒度保持在关键项，不把所有配置都写成冗长文档。

## Capabilities

### New Capabilities
- `config-rationale-journal-and-safe-default-audits`: 定义配置理由日志和默认值审计。

### Modified Capabilities
- `config-profile-diff-and-drift-explainer`: 漂移解释需要引用配置理由。
- `migration-readiness-report-and-rollback-checkpoints`: 迁移报告需要知道默认值变更风险。
- `state-schema-ownership-and-change-review-checklists`: 变更检查需要纳入关键配置理由复核。

## Impact

- Backend：会影响配置元数据、理由记录和审计输出。
- Frontend：会影响配置页说明、变更提示和审计查看器。
- Dependencies：这条线承接 `c565`、`c595`，也会给 `c980` 提供更明确的检查上下文。

```mermaid
flowchart LR
  C565[c565 配置漂移解释]
  C595[c595 迁移准备与回滚点]
  C980[c980 状态 Schema 归属与检查]
  C960[c960 配置理由日志]

  C565 --> C960
  C595 --> C960
  C960 --> C980
```
