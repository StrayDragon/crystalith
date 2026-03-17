# frontend-list-virtualization-and-windowed-rendering 规范增量

## ADDED Requirements

### Requirement: High-growth Workspace Lists MUST Use Windowed Rendering
系统 MUST 让高增长列表默认使用 windowed rendering，而不是随着数据增长线性放大渲染成本。

#### Scenario: sources 或 outputs 列表持续增长
- **WHEN** 某个 workspace 列表进入高增长规模
- **THEN** 前端 SHALL 使用稳定 key 的 windowed rendering
- **AND** SHALL 避免一次性挂载全部 row

### Requirement: Virtualized Lists MUST Compose with Incremental Data Fetching
系统 MUST 让 virtualization 与分页或渐进拉取协同工作，而不是互相绕开。

#### Scenario: 用户滚动接近当前窗口尾部
- **WHEN** 虚拟列表接近已加载数据末尾
- **THEN** 前端 SHALL 按需拉取下一页或下一段数据
- **AND** SHALL 保持窗口化渲染而不是退回整表重渲染
