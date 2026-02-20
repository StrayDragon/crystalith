# vector-storage Specification

## Purpose
TBD - created by archiving change update-vector-storage. Update Purpose after archive.
## Requirements
### Requirement: Local Chroma Vector Storage
系统 MUST 提供基于 Chroma 的本地持久化向量存储（嵌入式模式），不依赖 sqlite-vss。搜索 MUST 使用 Chroma 原生 HNSW 索引，不在应用层做暴力遍历。

#### Scenario: 使用 Chroma 本地存储
- **WHEN** 配置 `vector_storage.provider` 为 `chroma`
- **THEN** 系统使用 Chroma 持久化存储向量
- **AND** 重启后数据仍可检索

#### Scenario: 不加载 sqlite-vss
- **WHEN** 系统以本地 Chroma 模式启动
- **THEN** 不尝试加载 sqlite-vss 扩展
- **AND** 不出现 sqlite-vss fallback 警告

#### Scenario: 持久化路径不可写
- **WHEN** `vector_storage.chroma.path` 指向不可写目录
- **THEN** 启动失败并给出明确错误信息

#### Scenario: 默认禁用遥测
- **WHEN** `vector_storage.chroma.telemetry` 未设置或为 false
- **THEN** Chroma 遥测保持关闭

#### Scenario: 使用 ANN 索引搜索
- **WHEN** 调用 Chroma 向量存储的 `search` 方法
- **THEN** 系统使用 Chroma 原生 `collection.query()` 执行 ANN 搜索
- **AND** 不加载全量条目到内存
- **AND** 支持 `source_id_set` 过滤条件通过 Chroma where 子句实现

### Requirement: Vector Storage Provider Configuration
系统 MUST 支持通过 `vector_storage.provider` 选择向量后端，并支持 `memory` 与 `chroma`；`sqlite` 作为兼容别名映射到本地 Chroma。

#### Scenario: 使用内存存储
- **WHEN** 配置 `vector_storage.provider` 为 `memory`
- **THEN** 系统使用内存存储向量
- **AND** 重启后数据丢失

#### Scenario: 使用 sqlite 兼容别名
- **WHEN** 配置 `vector_storage.provider` 为 `sqlite`
- **THEN** 系统使用本地 Chroma 持久化存储向量

### Requirement: Legacy SQLite 迁移
系统 MUST 提供从旧 SQLite 向量库迁移到 Chroma 的工具或函数。

#### Scenario: 迁移旧数据
- **WHEN** 迁移工具执行
- **THEN** 旧库中的向量在 Chroma 中可检索

### Requirement: 向量搜索来源排除
系统 MUST 支持在向量搜索时排除指定来源的条目，用于跨文档分析等场景。

#### Scenario: 排除同一来源的搜索结果
- **WHEN** 调用 `search` 时传入 `exclude_source_ids` 参数
- **THEN** 返回结果不包含指定来源的条目
- **AND** 其他来源的条目正常返回

### Requirement: Multi-query Result Fusion
系统 MUST 为 multi-query 检索提供稳健的合并策略（例如 RRF），避免仅以“最大 score”作为唯一合并信号。

#### Scenario: RRF 融合奖励跨 query 一致高排名
- **GIVEN** multi-query 检索返回多个结果列表
- **WHEN** 系统合并这些列表
- **THEN** 合并排序 SHOULD 优先包含在多个列表中均高排名的 chunk
- **AND** 不应仅由单一列表的最大 score 支配最终排序

### Requirement: Fusion Strategy is Testable
系统 SHOULD 将 multi-query 融合策略实现为可单测的纯函数（或可注入策略），以便对排序行为做回归测试。

#### Scenario: 融合策略可回归
- **WHEN** 使用固定输入结果列表运行融合函数
- **THEN** 输出排序 MUST 稳定且可预测（与策略参数一致）
