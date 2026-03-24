# backend-deps-and-app-state-contract 规范增量

## ADDED Requirements

### Requirement: Backend Dependencies MUST Expose a Stable AppState Contract
系统 MUST 为核心后端依赖定义稳定的 `AppState` / deps contract，而不是让各模块直接猜测资源是否存在以及如何关闭。

#### Scenario: Feature endpoint 读取运行时依赖
- **WHEN** 某个 feature 通过 deps 层请求 DB、cache、vector store、queue 或等价核心依赖
- **THEN** 系统 SHALL 通过稳定 contract 提供这些依赖
- **AND** SHALL 明确该依赖是 required 还是 optional
- **AND** SHALL 明确失败时返回的稳定运行时语义

### Requirement: Test and Diagnostic Modes MUST Reuse the Same Dependency Contract
系统 MUST 允许测试、诊断或降级模式复用同一套依赖 contract，而不是各自旁路装配。

#### Scenario: 系统切换到替身注入或降级模式
- **WHEN** 集成测试或诊断模式替换某个核心依赖
- **THEN** 替身资源 SHALL 仍遵守相同的 deps contract
- **AND** 调用方 SHALL 不需要重新发明另一套接入方式
