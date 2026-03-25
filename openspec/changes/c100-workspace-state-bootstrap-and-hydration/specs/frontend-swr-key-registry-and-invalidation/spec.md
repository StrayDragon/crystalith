# frontend-swr-key-registry-and-invalidation 规范增量

## ADDED Requirements

### Requirement: Fetching and Invalidation MUST Use Shared Key Builders
系统 MUST 让前端 domain hooks 使用共享 key builders 与稳定 invalidation 语义。

#### Scenario: 多处消费同一对象摘要
- **WHEN** 不同 hooks 读取同一 notebook/session/source/output 的列表或摘要
- **THEN** 前端 SHALL 通过共享 key builders 生成 keys
- **AND** mutation 后 SHALL 能精确失效相关 keys

### Requirement: Stale Responses MUST Be Dropped Deterministically
系统 MUST 在 scope 切换或请求取消后丢弃 stale response，而不是允许旧响应覆盖新状态。

#### Scenario: 用户快速切换 scope
- **WHEN** 旧请求在新 scope 请求之后才返回
- **THEN** 前端 SHALL 丢弃旧响应
- **AND** SHALL 不让其污染当前 UI 状态

### Requirement: Snapshot Resume MUST Revalidate Safely
系统 MUST 允许从快照恢复前端缓存，但恢复后必须走安全的后台 revalidate。

#### Scenario: 页面刷新后快速恢复
- **WHEN** 前端从本地 snapshot 恢复部分缓存
- **THEN** 系统 SHALL 先用 snapshot 让 UI 可用
- **AND** SHALL 在后台进行 revalidate 并平滑更新
