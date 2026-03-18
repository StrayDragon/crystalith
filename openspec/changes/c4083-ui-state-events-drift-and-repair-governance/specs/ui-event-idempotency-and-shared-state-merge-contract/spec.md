# ui-event-idempotency-and-shared-state-merge-contract 规范增量

## ADDED Requirements

### Requirement: UI Mutations MUST Be Idempotent and Revision-aware
系统 MUST 让 UI event processing 同时满足幂等与 revision-aware merge，而不是把重试和冲突处理交给偶然行为。

#### Scenario: 客户端重复提交同一 UI 事件
- **WHEN** 客户端因为重试或断线恢复重复提交同一个 `client_request_id`
- **THEN** 系统 SHALL 返回稳定的 replay 结果
- **AND** SHALL 保持与第一次应用时一致的共享状态语义

### Requirement: Shared State Conflicts MUST Surface Deterministic Merge Outcomes
系统 MUST 对 shared state 冲突给出稳定 merge outcome，而不是静默覆盖。

#### Scenario: base revision 已经过期
- **WHEN** 某次 UI event 的 `baseRevision` 已落后于当前 shared state
- **THEN** 系统 SHALL 明确返回 APPLIED、REPLAYED 或 CONFLICT 等稳定结果
- **AND** 在冲突时 SHALL 提供可执行的 rebase 或恢复提示
