# weekly-synthesis-and-personal-knowledge-rollups 规范增量

## ADDED Requirements

### Requirement: Weekly Synthesis MUST Capture Net-new Knowledge, Not Just Activity Logs
系统 MUST 让 weekly synthesis 优先提炼真正新增的认识与未闭合问题，而不是机械汇总活动流水。

#### Scenario: 系统生成一周总结
- **WHEN** 某个用户触发 weekly synthesis
- **THEN** 系统 SHALL 汇总本周新增来源、判断、输出与 open questions
- **AND** SHALL 尽量区分新认识与单纯活动记录

### Requirement: Rollups MUST Feed Back into Threads and Future Work
系统 MUST 让 knowledge rollups 回接长线线程、问题线程与下一次执行入口，而不是做成只读周报。

#### Scenario: 用户查看某次 weekly rollup
- **WHEN** 用户打开周综合或阶段总结
- **THEN** 系统 SHALL 能跳回相关 threads、memory fragments 或 next-run seeds
- **AND** 这些回接关系 SHALL 可被后续 continuity 功能复用
