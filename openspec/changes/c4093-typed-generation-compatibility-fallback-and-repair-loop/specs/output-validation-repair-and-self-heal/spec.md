# output-validation-repair-and-self-heal 规范增量

## ADDED Requirements

### Requirement: Repair MUST Be Limited to Verifiable Structural Issues
系统 MUST 将 repair 限定在可验证的结构完整性问题，而不是借修补之名改写核心事实或论证语义。

#### Scenario: 某个结果结构不完整但核心内容仍可用
- **WHEN** 后验校验发现字段缺失、局部 payload 非法或结构不完整
- **THEN** 系统 SHALL 仅对这些可验证问题执行 repair
- **AND** SHALL 不借此改写核心事实内容

### Requirement: Repair Outcomes MUST Distinguish Auto-Repair, Confirm-First, and Must-Rerun
系统 MUST 区分自动可修、需确认后修补和必须重跑三类 repair outcome，而不是统一处理为静默修补。

#### Scenario: 系统评估一次 repair 候选
- **WHEN** 某个结果被判定为可进入 repair loop
- **THEN** 系统 SHALL 将其分类为 auto-repair、confirm-before-repair 或 must-rerun
- **AND** SHALL 保留修补前后差异与回退能力
