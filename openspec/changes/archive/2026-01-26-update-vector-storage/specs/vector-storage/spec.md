## ADDED Requirements

### Requirement: Local Chroma Vector Storage
系统 MUST 提供基于 Chroma 的本地持久化向量存储（嵌入式模式），不依赖 sqlite-vss。

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
