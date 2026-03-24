# search-index-incremental-refresh-and-staleness-diagnostics 规范增量

## ADDED Requirements

### Requirement: Search Index Refresh MUST Be Modeled as Explicit Jobs with Visibility Semantics
系统 MUST 将索引刷新建模为显式 job 与可见性生命周期，而不是一组隐式副作用。

#### Scenario: source 内容刚更新但索引尚未完全可见
- **WHEN** 某个 source 更新触发索引刷新
- **THEN** 系统 SHALL 跟踪对应 refresh job 的状态
- **AND** SHALL 明确当前结果是否仍受旧 generation 或 stale state 影响

### Requirement: Staleness Diagnostics MUST Explain Why New Content Is Not Yet Searchable
系统 MUST 能解释“为什么还搜不到”而不是只显示笼统 loading 或未知延迟。

#### Scenario: 用户刚导入内容后立即搜索
- **WHEN** 新 source 或更新内容尚未进入最终可见索引
- **THEN** 系统 SHALL 暴露稳定的 staleness reason
- **AND** SHALL 说明是排队、失败、等待 commit 还是其他受控原因
