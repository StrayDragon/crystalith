# retrieval-qos-budgets-and-priority-lanes 规范增量

## ADDED Requirements

### Requirement: Retrieval Work MUST Be Scheduled Through Explicit Priority Lanes
系统 MUST 让 retrieval 相关工作通过显式 priority lanes 调度，而不是让前台与后台任务抢同一池资源。

#### Scenario: 前台请求与后台回填同时发生
- **WHEN** interactive retrieval 与 background/maintenance 工作竞争资源
- **THEN** 系统 SHALL 根据定义好的 priority lanes 调度
- **AND** SHALL 优先保护交互式请求的体感

### Requirement: QoS Decisions MUST Be Observable and Explainable
系统 MUST 让排队、让路、降级与预算命中成为可观测决策，而不是隐藏在 limiter 背后。

#### Scenario: 某个请求被延后或降级
- **WHEN** 系统因预算或 provider 状态推迟、拆批或降级某次 retrieval 工作
- **THEN** 系统 SHALL 暴露对应的 reason code 或等价解释
- **AND** SHALL 能将该决策关联到同一次请求或任务
