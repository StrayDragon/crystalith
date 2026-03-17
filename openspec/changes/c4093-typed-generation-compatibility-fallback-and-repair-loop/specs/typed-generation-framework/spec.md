# typed-generation-framework 规范增量

## ADDED Requirements

### Requirement: Generation Types MUST Declare Compatibility, Fallback, and Repair Hooks
系统 MUST 让 generation type 显式声明 compatibility、fallback 和 repair hooks，而不是把这些控制逻辑散落在 output type 或调用方里。

#### Scenario: 系统注册一个 generation type
- **WHEN** 某个 generation type 被新增或加载
- **THEN** 该类型 SHALL 声明其 compatibility needs、allowed fallback classes 和 repair policy
- **AND** 下游能力 SHALL 通过这些 hook 扩展治理逻辑
