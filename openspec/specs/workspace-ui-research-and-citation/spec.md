# workspace-ui-research-and-citation Specification

## Purpose

定义 Deep Research 与 Citation 交互约束：研究会话生命周期、SSE 连接治理、引用预览与跳转。

## Non-goals

- 不定义研究图算法细节
- 不定义来源摄取接口

## Requirements

### Requirement: Research session state is single-source
研究详情页 MUST 以最新 research session 状态为准渲染。

### Requirement: SSE lifecycle is robust
研究相关 SSE 连接 MUST 显式管理连接中、断开、重连、结束状态。

### Requirement: Reconnect gating uses latest session state
重连判断 MUST 基于最新会话状态，避免 stale session 导致错误重连。

### Requirement: Thinking/progress rendering is incremental
研究过程中的进度与思考信息 SHOULD 渐进展示，避免整段阻塞刷新。

### Requirement: Citation hover and click interactions are stable
引用 MUST 支持悬停预览与点击导航，两者行为在各面板保持一致。
