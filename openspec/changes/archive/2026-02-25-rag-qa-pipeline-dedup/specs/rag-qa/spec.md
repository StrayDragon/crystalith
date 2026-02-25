# rag-qa (delta) Specification

## ADDED Requirements

### Requirement: Streaming and non-streaming QA MUST share retrieval metadata
系统 MUST 保证同一输入在非流式 QA 与流式 QA（以 `done` 事件为准）返回一致的检索与引用元信息：

- `citations` 数组（内容与顺序）
- `evidence` 布尔值
- `confidence` 数值
- `context` 统计字段（若存在）

#### Scenario: Same request yields consistent metadata
- **WHEN** 客户端对同一 notebook 以相同参数分别调用非流式 QA 与流式 QA
- **THEN** 非流式响应与流式 `done` 事件在 `citations/evidence/confidence/context` 上一致
