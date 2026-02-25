# workspace-ui-analysis Specification

## Purpose

定义工作区分析体验：Analysis 面板状态机与全屏知识图谱交互。

## Non-goals

- 不定义分析算法与聚类参数
- 不定义底层向量检索实现

## Requirements

### Requirement: Analysis panel states are complete
面板 MUST 覆盖空态、未分析、加载、错误、已分析五类状态。

### Requirement: Analysis rendering stays bounded
topics/relations/contradictions 渲染 MUST 可截断与限量，避免 UI 失控。

### Requirement: Graph view is full-screen and refreshable
知识图谱 MUST 以全屏 overlay 打开，提供刷新与关闭入口。

### Requirement: Node and edge taxonomy is stable
图谱节点与边类型（sources/outputs/sessions 及其关联）MUST 保持稳定语义。

### Requirement: Interaction and filtering are available
图谱 MUST 支持拖拽、缩放、筛选、节点预览与详情跳转。

### Requirement: Chunk-to-source mapping is best-effort safe
映射缺失时 UI MUST 降级可用，不得崩溃。
