## ADDED Requirements

### Requirement: Zustand Store Architecture
前端 SHALL 使用 Zustand 进行工作区状态管理，替代 React Context + useReducer。状态 MUST 按领域拆分为独立的 slice（notebooks, sessions, sources, messages, outputs, research, ui）。

#### Scenario: 细粒度状态订阅
- **WHEN** source 列表发生变化
- **THEN** 仅订阅 sources slice 的组件重渲染，其他面板不受影响

#### Scenario: Domain hook 接口不变
- **WHEN** 组件调用 useNotebooks() hook
- **THEN** 返回与迁移前相同的接口（notebooks 列表、CRUD 方法等）

#### Scenario: 跨 slice 状态引用
- **WHEN** sessions slice 需要引用当前 active notebook id
- **THEN** 通过 store.getState() 或 selector 组合访问，不引入循环依赖
