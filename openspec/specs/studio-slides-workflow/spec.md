# studio-slides-workflow Specification

## Purpose

定义 SLIDES 的端到端工作流：draft 单一事实源、outline/markdown SSE、保存同步与预览链路。

## Non-goals

- 不定义其他输出类型的交互
- 不定义前端整体 Studio 布局

## Requirements

### Requirement: Slides are draft-centric across three stages
slides MUST 围绕 draft 运行 input/outline/markdown 三阶段并可恢复。

### Requirement: Draft API contract is stable
draft CRUD、outline 保存、markdown 保存端点 MUST 保持稳定。

### Requirement: SSE endpoints and events are stable
outline/markdown stream MUST 使用稳定事件集合 `progress/toolcall/done/busy/error`。

### Requirement: Busy and stale-running handling is explicit
draft `running` 时 MUST 防并发重复；stale running MUST 先清理再继续。

### Requirement: Markdown generation requires existing outline
未有 outline 时 markdown stream MUST 返回可读错误并结束连接。

### Requirement: Successful generation persists draft before done
生成成功 MUST 先持久化 draft（含 chunk_ids/stage/status），再发 `done`。

### Requirement: Preview always uses latest saved markdown
预览前端流程 MUST 先保存 markdown，再刷新外部 Slidev 预览。
