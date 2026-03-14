# quality-gates-for-generation 规范增量

## ADDED Requirements

### Requirement: 生成结果必须具备质量门状态
系统 MUST 为生成结果提供可消费的质量门状态，而不是只暴露“是否生成成功”。

#### Scenario: 结果生成完成后附带质量状态
- **WHEN** 一个生成结果进入完成态
- **THEN** 系统 SHALL 为其附带质量门状态
- **AND** 该状态 SHALL 至少能区分通过、警告与阻断

### Requirement: 质量门必须返回结构化原因
系统 MUST 为质量门结果返回结构化原因，以支持解释、展示和后续治理。

#### Scenario: 结果触发质量告警
- **WHEN** 某个生成结果触发质量门
- **THEN** 系统 SHALL 返回结构化原因
- **AND** 结构化原因 SHALL 包含触发维度、触发原因与建议动作摘要

### Requirement: 质量门必须可跨生成类型复用
系统 MUST 将质量门定义为可复用能力，而不是某个结果类型的私有规则。

#### Scenario: 不同生成类型接入同一质量门能力
- **WHEN** 两类不同的生成类型都需要最小质量判断
- **THEN** 系统 SHALL 允许它们消费同一套质量门模型
- **AND** SHALL 通过类型配置决定适用门槛，而不是复制规则体系

### Requirement: 质量门必须在生成完成后接入并写入结果元数据
系统 MUST 在生成完成并完成最小后处理后运行质量门，并将结果写入生成结果元数据后返回给客户端。

#### Scenario: 系统在结果返回前运行质量门
- **WHEN** 一个生成结果完成并准备返回
- **THEN** 系统 SHALL 运行质量门检查
- **AND** 系统 SHALL 把质量门的整体状态与明细写入结果元数据

### Requirement: 前端必须可统一展示质量告警、阻断原因与建议动作
系统 MUST 让前端可以基于结构化字段统一展示质量告警/阻断原因，并提供建议动作提示，而不是依赖不可解释的文本拼接。

#### Scenario: 用户查看带质量告警的结果
- **WHEN** 用户打开一个触发 warn/block 的结果
- **THEN** 前端 SHALL 能展示触发的质量门列表与原因
- **AND** 前端 SHALL 能展示每个门的建议动作摘要

### Requirement: 系统必须记录质量门结果用于观测与治理
系统 MUST 记录每次质量门的结果，以支持按类型与 gate 维度的观测与后续治理策略。

#### Scenario: 运营或开发查看质量门趋势
- **WHEN** 需要分析某段时间内质量告警/阻断趋势
- **THEN** 系统 SHALL 能按 gate_id 与 generation_type 维度聚合统计 pass/warn/block
