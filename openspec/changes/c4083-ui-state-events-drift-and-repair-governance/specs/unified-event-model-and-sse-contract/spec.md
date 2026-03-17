# unified-event-model-and-sse-contract 规范增量

## ADDED Requirements

### Requirement: Streaming UI Events MUST Use a Unified Envelope
系统 MUST 让 SSE 或等价流式 UI 事件使用统一 event envelope，而不是按 endpoint 各自生长 payload。

#### Scenario: 前端消费不同工作面的流式事件
- **WHEN** 前端订阅 research、QA、studio 或等价 stream
- **THEN** 系统 SHALL 通过统一 envelope 传递 event id、kind、correlation 与 payload
- **AND** 前端 SHALL 能使用同一套解析和分发路径

### Requirement: Event Replay and Backpressure MUST Be Explicitly Modeled
系统 MUST 为 event replay、buffer window 与 slow-client backpressure 定义稳定语义，而不是让断线/慢客户端表现为随机丢事件。

#### Scenario: 客户端断线后重新连接
- **WHEN** 客户端携带 `Last-Event-ID` 或等价断点信息重连
- **THEN** 系统 SHALL 根据受控 replay window 补发可恢复事件
- **AND** 若发生裁剪或降级，SHALL 提供可诊断的解释信号
