# question-led-research-threads-and-answer-status 规范增量

## ADDED Requirements

### Requirement: Research Threads MUST Support Question-first Organization
系统 MUST 支持以问题为一等入口组织研究线程，而不是只按主题容器组织内容。

#### Scenario: 用户围绕一个具体问题展开研究
- **WHEN** 用户创建或持续推进某个待回答问题
- **THEN** 系统 SHALL 允许该问题驱动 thread 组织 sources、runs 与 outputs
- **AND** SHALL 让该 question thread 能挂接到更大的 long-arc thread

### Requirement: Answer Status MUST Make Uncertainty and Incompleteness Explicit
系统 MUST 通过 answer status 明确表达问题当前的回答成熟度，而不是只剩“做过/没做过”。

#### Scenario: 某个问题仍证据不足
- **WHEN** question thread 尚未形成稳定答案
- **THEN** 系统 SHALL 提供如未回答、初步回答、证据不足、暂时搁置等稳定状态
- **AND** SHALL 让这些状态影响后续 review、rollup 与 next-run continuity
