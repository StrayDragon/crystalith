## ADDED Requirements

### Requirement: Backend typecheck entrypoint exists
后端 MUST 提供可一键运行的静态类型检查入口，并在出现类型错误时以非 0 退出码失败。

#### Scenario: Run backend typecheck locally
- **WHEN** 开发者运行 `cd backend/py && just typecheck`
- **THEN** 系统 SHALL 执行基于 basedpyright 的类型检查并在检测到错误时失败
