# source-connectors 规范增量

## ADDED Requirements

### Requirement: 宿主必须暴露统一的连接器发现与绑定语义
系统 MUST 以宿主能力的形式暴露连接器发现与 notebook-scoped binding，而不是让每个 connector 自行定义接入方式。

#### Scenario: notebook 加载可用连接器
- **WHEN** 客户端请求某个 notebook 的可用连接器
- **THEN** 系统 SHALL 返回可用 connector 列表、配置 schema 与诊断信息
- **AND** 创建连接后 SHALL 生成 notebook-scoped binding

### Requirement: 宿主必须采用快照优先与选择性导入
系统 MUST 先返回 snapshot，再允许用户确认导入范围，而不是默认直接整库导入。

#### Scenario: 用户接入大型外部资料仓
- **WHEN** 用户创建一个 connector binding 并请求 snapshot
- **THEN** 系统 SHALL 返回可预览的快照条目
- **AND** 用户 SHALL 能基于目录或文件确认 import_scope 后再执行导入

### Requirement: 宿主必须以显式 sync_check 驱动同步
系统 MUST 先执行 `sync_check` 再确认应用变更，而不是静默地改写来源集合。

#### Scenario: 用户执行同步检查
- **WHEN** 用户对已保存的 binding 发起 `sync_check`
- **THEN** 系统 SHALL 返回结构化差异结果
- **AND** SHALL 在用户确认前不直接修改现有来源
