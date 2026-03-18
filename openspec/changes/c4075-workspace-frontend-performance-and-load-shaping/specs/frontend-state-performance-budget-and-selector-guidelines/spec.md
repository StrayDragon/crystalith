# frontend-state-performance-budget-and-selector-guidelines 规范增量

## ADDED Requirements

### Requirement: Components MUST Subscribe Through Minimal Selectors
系统 MUST 要求前端组件通过最小 selector 订阅状态，而不是直接依赖整个 store。

#### Scenario: 组件读取共享 store
- **WHEN** 某个组件从全局或 domain store 读取状态
- **THEN** 组件 SHALL 只订阅其真正需要的最小字段集合
- **AND** SHALL 避免因无关字段变化引发级联 rerender

### Requirement: Slow Interactions MUST Be Attributable to State Usage Patterns
系统 MUST 让慢交互能追溯到 selector、derived state 或 render 路径，而不是只得到模糊的“某处卡顿”。

#### Scenario: 某次交互触发明显卡顿
- **WHEN** 系统检测到关键交互超出预算
- **THEN** 开发者 SHALL 能定位到相关 selector、memo 或 render 热点
- **AND** 该归因信息 SHALL 与 perf report 或 overlay 保持一致
