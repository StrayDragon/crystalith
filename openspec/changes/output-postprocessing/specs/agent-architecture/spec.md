## ADDED Requirements

### Requirement: OutputGraph includes postprocessing step
系统 MUST 在 OutputGraph 中包含一个 postprocessing 步骤（节点或等价逻辑），用于在 citations 映射与持久化前保证内容满足最低渲染契约。

#### Scenario: Postprocessing 在持久化前执行
- **WHEN** OutputGraph 准备持久化 output
- **THEN** 系统已完成 postprocessing
