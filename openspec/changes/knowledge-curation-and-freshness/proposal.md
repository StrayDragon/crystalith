## Why

当 Crystalith 从短时会话工具逐步变成长期知识工作台后，真正难的问题不再只是“怎么导入资料”，而是“导入后的资料如何长期维护”：

- 来源会过时，但系统未必知道哪些内容已经 stale
- 重复来源、相近来源、老 embedding 可能持续堆积
- 用户难以判断何时应该重新导入、重新嵌入或清理来源

因此，这个 proposal 聚焦于 **knowledge curation and freshness**，把知识维护做成系统能力，而不是留给用户凭记忆处理。

## What Changes

- 新增 freshness 信号、过时提示和来源健康状态
- 支持识别重复来源或高相似来源，并给出整理建议
- 支持 re-ingest / re-embed 建议与策略提示
- 让长期知识库维护成为产品正式能力，而不是后台隐性问题

## Before / After

### 实现前
- 来源一旦导入，系统很少主动提示是否该维护
- stale、重复、embedding 老化等问题逐步积累
- 用户主要靠经验判断知识库是否健康

### 实现后
- 系统能主动提示来源新鲜度和维护建议
- 用户能更有依据地执行清理、重导入、重嵌入
- Crystalith 更适合长期沉淀与持续使用

## 优点

- 长期价值非常高，能防止知识库随时间劣化
- 与 connector、retrieval、quality 等方向天然互补
- 有助于把“资料管理”升级为“知识运营”

## 风险与代价

- freshness 和 dedup 常依赖启发式规则，可能有噪音
- 需要更多后台计算与状态追踪
- 如果提示太多，容易造成打扰和告警疲劳

## Capabilities

### New Capabilities
- `knowledge-curation-and-freshness`: 提供来源新鲜度、重复检测与维护建议能力

### Modified Capabilities
- `source-ingestion-management-and-tags`: 需要扩展来源管理状态与维护动作
- `retrieval-and-cache`: 需要考虑 stale source 与 re-embed 语义
- `source-ingestion-core`: 需要支持重新导入和重新嵌入的稳定路径

## Impact

- Backend
  - 新增 freshness 指标、重复检测和维护建议逻辑
- Frontend
  - 新增来源健康状态、维护提示和操作入口
- Product
  - Crystalith 从“能积累资料”升级为“能维护长期知识资产”
