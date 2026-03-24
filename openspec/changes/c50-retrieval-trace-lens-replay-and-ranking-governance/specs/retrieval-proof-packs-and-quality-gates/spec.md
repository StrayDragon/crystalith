# retrieval-proof-packs-and-quality-gates 规范增量

## ADDED Requirements

### Requirement: Retrieval Failures and Drift MUST Be Capturable as Proof Packs
系统 MUST 支持把检索/引用问题收集为最小 proof pack，而不是要求人工重新拼凑复现材料。

#### Scenario: 某次检索结果需要诊断或报错
- **WHEN** 用户或系统需要导出一次 retrieval bug report
- **THEN** proof pack SHALL 包含 `snapshot_id`、关键 chunks、引用定位与必要配置摘要
- **AND** SHALL 明确分享前的脱敏边界

### Requirement: Retrieval Quality Gates MUST Diff Traceable Evidence, Not Just Aggregate Scores
系统 MUST 让 retrieval quality gates 比较可追踪的 evidence drift，而不是只盯单一总分。

#### Scenario: 版本升级触发检索回归检查
- **WHEN** 系统运行 retrieval/citation regression suite
- **THEN** gate SHALL 能指出 top sources、citation validity、anchor confidence 或等价关键维度的变化
- **AND** 失败输出 SHALL 携带可 replay 的定位材料
