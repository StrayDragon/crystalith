# studio-slides-workflow Specification

## Purpose

定义 SLIDES 的端到端工作流：draft 单一事实源、outline/markdown SSE、保存同步与预览链路。该规范用于保证断线重连、重试与预览刷新时的状态一致性。

## Non-goals

- 不定义其他输出类型的交互
- 不定义前端整体 Studio 布局

## Requirements

### Requirement: Slides are draft-centric across three stages
slides MUST 围绕 draft 运行 input/outline/markdown 三阶段并可恢复。

#### Scenario: Draft-centric stages are recoverable
- **WHEN** 用户在 input/outline/markdown 任一阶段中断并稍后返回
- **THEN** 系统 SHALL 能从 draft 恢复到最近保存的阶段状态

### Requirement: Draft API contract is stable
draft CRUD、outline 保存、markdown 保存端点 MUST 保持稳定。

#### Scenario: Draft endpoints remain stable
- **WHEN** 客户端调用 draft CRUD 与保存端点
- **THEN** 系统 SHALL 保持端点与字段语义稳定以避免客户端漂移

### Requirement: SSE endpoints and events are stable
outline/markdown stream MUST 使用稳定事件集合 `progress/toolcall/done/busy/error`。

#### Scenario: SSE emits stable event set
- **WHEN** outline 或 markdown 通过 SSE 流式生成
- **THEN** 系统 SHALL 仅使用 `progress/toolcall/done/busy/error` 事件集合并保持语义稳定

### Requirement: Busy and stale-running handling is explicit
draft `running` 时 MUST 防并发重复；stale running MUST 先清理再继续。

#### Scenario: Busy requests are rejected and stale is cleared
- **WHEN** draft 处于 `running` 且用户再次发起生成
- **THEN** 系统 SHALL 明确拒绝并发重复；若检测到 stale running，则先清理再允许继续

### Requirement: Markdown generation requires existing outline
未有 outline 时 markdown stream MUST 返回可读错误并结束连接。

#### Scenario: Markdown requires outline
- **WHEN** 用户在未生成/保存 outline 的情况下请求 markdown stream
- **THEN** 系统 SHALL 返回可读错误并结束连接

### Requirement: Successful generation persists draft before done
生成成功 MUST 先持久化 draft（含 chunk_ids/stage/status），再发 `done`。

#### Scenario: Draft is persisted before done
- **WHEN** 生成成功并准备发送 `done`
- **THEN** 系统 SHALL 先持久化 draft（含 chunk_ids/stage/status）再发送 `done`

### Requirement: Preview always uses latest saved markdown
预览前端流程 MUST 先保存 markdown，再刷新外部 Slidev 预览。

#### Scenario: Preview uses latest markdown
- **WHEN** 用户触发预览刷新
- **THEN** 系统 SHALL 先保存 markdown 再刷新外部 Slidev 预览以确保一致性
