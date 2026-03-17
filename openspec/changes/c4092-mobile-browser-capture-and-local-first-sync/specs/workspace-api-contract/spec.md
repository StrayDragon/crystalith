# workspace-api-contract 规范增量

## ADDED Requirements

### Requirement: Workspace API MUST Expose Stable Sync Preflight and Queue Replay Semantics
系统 MUST 提供稳定的 sync preflight、conflict summary 和 queue replay 接口语义，以支持 local-first 客户端在真正同步前做判断。

#### Scenario: 客户端请求同步预检
- **WHEN** mobile、browser extension 或 desktop client 请求同步预检
- **THEN** 系统 SHALL 返回稳定的结果分类与风险摘要
- **AND** SHALL 提供队列回放或等价恢复所需的最小信息
