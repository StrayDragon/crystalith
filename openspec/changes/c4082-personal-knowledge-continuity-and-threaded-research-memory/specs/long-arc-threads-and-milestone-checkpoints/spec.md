# long-arc-threads-and-milestone-checkpoints 规范增量

## ADDED Requirements

### Requirement: Related Work Across Sessions MUST Collapse into Long-arc Threads
系统 MUST 能把跨多次 session、run、notebook 和 output 的相关工作聚合为 long-arc threads，而不是只保留一次次局部活动。

#### Scenario: 同一主题持续推进数周
- **WHEN** 用户围绕同一主题反复补来源、改结论或更新输出
- **THEN** 系统 SHALL 将这些推进关联到同一 long-arc thread
- **AND** SHALL 支持线程级回看与继续入口

### Requirement: Milestones MUST Mark Durable Progress and Open Gaps
系统 MUST 让 milestone checkpoints 同时记录已形成的阶段成果与仍未解决的缺口。

#### Scenario: 用户在长线线程中到达一个阶段节点
- **WHEN** 系统或用户创建 milestone
- **THEN** milestone SHALL 能表达已形成判断、剩余缺口与下次接续点
- **AND** SHALL 可被 recall、rollup 与 next-run flows 复用
