# profile-capability-matrix-and-degraded-mode-explainer 规范增量

## ADDED Requirements

### Requirement: Capability Matrix MUST Explain Available, Degraded, and Unavailable States
系统 MUST 为当前 profile 输出 capability matrix，并对每项能力给出 `available`、`degraded` 或 `unavailable` 状态以及解释字段。

#### Scenario: 用户查看当前环境有哪些能力受限
- **WHEN** 客户端请求当前 profile 的能力摘要
- **THEN** 系统 SHALL 返回 capability 状态、reason_code 与 next_action
- **AND** SHALL 区分“完全不可用”与“可降级继续使用”

### Requirement: Optional Services Readiness MUST Feed Capability Evaluation
系统 MUST 将 optional services readiness 作为 capability matrix 的正式输入，而不是在 UI 中临时推断。

#### Scenario: 可选服务缺失导致能力降级
- **WHEN** 某项能力依赖的可选服务 probe 失败
- **THEN** capability matrix SHALL 反映对应能力为 `degraded` 或 `unavailable`
- **AND** SHALL 提供恢复提示而不是只暴露原始探活失败

### Requirement: Parser Fallbacks MUST Be Explained as Fidelity Changes
系统 MUST 将 parser/format fallback 解释为保真度变化，而不是只有成功/失败二元状态。

#### Scenario: 导入降级为纯文本
- **WHEN** 某类来源因 parser 不可用或回退策略只保留文本
- **THEN** 系统 SHALL 标明结构保真、文本保真或元数据保真受到的影响
- **AND** SHALL 给出下一步恢复动作或替代路径
