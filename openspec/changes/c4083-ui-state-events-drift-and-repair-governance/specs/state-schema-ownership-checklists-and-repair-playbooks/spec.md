# state-schema-ownership-checklists-and-repair-playbooks 规范增量

## ADDED Requirements

### Requirement: Critical State and UI Contracts MUST Have Explicit Ownership and Review Checklists
系统 MUST 为关键 state/schema/UI contracts 指定 ownership 与 review checklist，而不是在变更时临时猜测影响面。

#### Scenario: 某次变更涉及关键状态面
- **WHEN** 开发者修改关键 state schema、UI contract 或 drift baseline
- **THEN** 系统 SHALL 能指出该契约的归属边界和必查项
- **AND** SHALL 为 review 提供稳定 checklist

### Requirement: Contract Failures MUST Map to Repair Playbooks
系统 MUST 将 contract drift 或 state failures 映射到标准 repair playbooks，而不是每次重新发明排障路径。

#### Scenario: 某个 contract baseline 检测失败
- **WHEN** drift alert、journal inconsistency 或 schema contract failure 被发现
- **THEN** 系统 SHALL 能将该失败归类到稳定 taxonomy
- **AND** SHALL 提供对应的 repair playbook 与推荐修复入口
