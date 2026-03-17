# goal-briefs-and-success-criteria-contract 规范增量

## ADDED Requirements

### Requirement: Workflows MUST Start from Explicit Goal Briefs and Success Criteria
系统 MUST 允许 workflows 以显式 goal brief 与 success criteria 开始，而不是将目标散落在聊天或隐含上下文里。

#### Scenario: 用户准备发起一次研究或交付流程
- **WHEN** 用户定义某次工作要解决的问题或交付目标
- **THEN** 系统 SHALL 支持 goal brief 表达目标、边界和成功标准
- **AND** 后续 run 或 artifact SHALL 可回指该 brief

### Requirement: Run Success MUST Distinguish Process Completion from Goal Completion
系统 MUST 区分“流程执行完成”和“目标真正达成”，避免把空成功误判为成功。

#### Scenario: 某次 run 已经跑完
- **WHEN** 系统执行 success check
- **THEN** 系统 SHALL 判断该结果是否满足对应 goal contract
- **AND** 未达成时 SHALL 产出明确缺口摘要
