## ADDED Requirements

### Requirement: Multi-query Result Fusion
系统 MUST 为 multi-query 检索提供稳健的合并策略（例如 RRF），避免仅以“最大 score”作为唯一合并信号。

#### Scenario: RRF 融合奖励跨 query 一致高排名
- **GIVEN** multi-query 检索返回多个结果列表
- **WHEN** 系统合并这些列表
- **THEN** 合并排序 SHOULD 优先包含在多个列表中均高排名的 chunk
- **AND** 不应仅由单一列表的最大 score 支配最终排序

### Requirement: Fusion Strategy is Testable
系统 SHOULD 将 multi-query 融合策略实现为可单测的纯函数（或可注入策略），以便对排序行为做回归测试。

#### Scenario: 融合策略可回归
- **WHEN** 使用固定输入结果列表运行融合函数
- **THEN** 输出排序 MUST 稳定且可预测（与策略参数一致）
