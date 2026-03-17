# next-run-seeding-and-carry-forward-briefs 规范增量

## ADDED Requirements

### Requirement: Runs MUST Produce Structured Continuation Seeds
系统 MUST 允许一次 run 产出结构化 continuation seeds，而不是把“下次该做什么”留在零散备注里。

#### Scenario: 某次 run 结束但主题未闭合
- **WHEN** 用户结束一次 run 且仍存在后续动作
- **THEN** 系统 SHALL 生成可供后续执行消费的 next-run seeds
- **AND** SHALL 明确这些 seeds 属于系统建议还是用户确认

### Requirement: Carry-forward Briefs MUST Preserve Only the Highest-value Continuation Context
系统 MUST 让 carry-forward briefs 只保留继续推进所需的高价值上下文，而不是把整次 run 再复制一遍。

#### Scenario: 用户准备从上次工作继续
- **WHEN** 用户打开 carry-forward brief
- **THEN** 系统 SHALL 提炼最关键的遗留问题、建议动作与推荐入口
- **AND** SHALL 避免把 brief 扩展成冗长历史复述
