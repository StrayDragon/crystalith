## ADDED Requirements

### Requirement: 只读交互视图

系统 **MUST** 提供只读的思维导图交互视图。

#### Scenario: 缩放与平移

- **WHEN** 用户在思维导图上滚轮或拖拽
- **THEN** 视图支持缩放与平移

### Requirement: 节点折叠

系统 **MUST** 支持折叠与展开子节点。

#### Scenario: 折叠节点

- **WHEN** 用户点击带子节点的节点
- **THEN** 该节点的子树折叠

#### Scenario: 展开节点

- **WHEN** 用户再次点击该节点
- **THEN** 子树展开显示

### Requirement: 全局折叠控制

系统 **MUST** 提供展开全部/折叠全部控制。

#### Scenario: 折叠全部

- **WHEN** 用户点击“折叠”按钮
- **THEN** 所有可折叠节点收起

#### Scenario: 展开全部

- **WHEN** 用户点击“展开”按钮
- **THEN** 所有节点展开显示
