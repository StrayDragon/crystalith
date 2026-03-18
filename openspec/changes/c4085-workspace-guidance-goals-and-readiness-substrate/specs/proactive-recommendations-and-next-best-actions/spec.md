# proactive-recommendations-and-next-best-actions 规范增量

## ADDED Requirements

### Requirement: Next-best Actions MUST Be Grounded in Object State and Goal Context
系统 MUST 让主动建议建立在对象状态和目标上下文之上，而不是只输出泛泛提示。

#### Scenario: 用户处于半完成或结果生成后的工作态
- **WHEN** 系统生成 next-best actions 或建议问题
- **THEN** 这些建议 SHALL 反映当前对象 readiness、证据缺口或目标状态
- **AND** SHALL 能解释为何此刻推荐这一步

### Requirement: Guidance MUST Scale from First-run to Ongoing Work
系统 MUST 让主动 guidance 既服务首次成功路径，也服务长期工作推进，而不是两套彼此脱节的推荐系统。

#### Scenario: 老用户回到一个复杂 workspace
- **WHEN** 系统为已有工作区提供建议
- **THEN** 系统 SHALL 复用与 first-run 一致的状态与动作语义
- **AND** SHALL 根据上下文切换提醒强度与推荐粒度
