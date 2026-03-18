# maintenance-tooling 规范增量

## ADDED Requirements

### Requirement: Maintenance Actions MUST Support Preview Before Apply
系统 MUST 先提供 maintenance preview，再允许执行清理、失效或压缩动作。

#### Scenario: 用户预览一次清理动作
- **WHEN** 用户准备执行 retention cleanup、cache invalidation 或 compaction
- **THEN** 系统 SHALL 先返回影响范围与风险摘要
- **AND** SHALL 允许用户在确认前取消

### Requirement: Cache Invalidation MUST Explain Scope
系统 MUST 为 cache invalidation 提供作用范围说明，避免把局部问题直接扩大成全局清空。

#### Scenario: 用户检查某个缓存域的失效影响
- **WHEN** 用户查看某个缓存域的 invalidation preview
- **THEN** 系统 SHALL 返回局部失效或全局失效的影响说明
- **AND** SHALL 展示最近 epoch 变化或相关提示

### Requirement: Generated Asset Cleanup MUST Be Safe and Explainable
系统 MUST 将生成资产清理与陈旧 bundle 检测表达为可解释、可确认的动作。

#### Scenario: 发现旧 bundle 或残留资产
- **WHEN** 系统识别到不再被引用的旧 bundle 或中间产物
- **THEN** 系统 SHALL 提供清理建议与确认边界
- **AND** SHALL 不在未确认时直接删除高风险资产
