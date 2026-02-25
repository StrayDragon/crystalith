# rag-qa Specification

## ADDED Requirements

### Requirement: QA completion logic MUST be shared across stream and non-stream paths
系统 MUST 在流式与非流式 QA 路径中复用同一套完成阶段逻辑（消息持久化、context 统计映射、完成元信息构造），避免重复实现导致行为漂移。

#### Scenario: No-evidence completion remains consistent
- **WHEN** 同一输入在 stream/non-stream 路径均命中“无证据”分支
- **THEN** 两条路径都会使用共享完成逻辑持久化消息，并返回一致的 `evidence=false` 与空 citations 元信息

#### Scenario: Evidence completion remains consistent
- **WHEN** 同一输入在 stream/non-stream 路径命中“有证据”分支
- **THEN** 两条路径都会使用共享完成逻辑持久化消息，并返回一致的 citations/confidence/context 元信息
