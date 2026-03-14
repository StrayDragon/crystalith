# source-connectors 规范增量

## ADDED Requirements

### Requirement: 连接器发现必须返回 notebook 作用域下的可用连接器
系统 MUST 以 notebook 为作用域暴露当前可用的 source connectors、配置 schema 与诊断信息。

#### Scenario: 前端加载 notebook 的连接器列表
- **WHEN** 客户端请求某个 notebook 的 source connectors
- **THEN** 系统 SHALL 返回该 notebook 可用的连接器描述、配置 schema 与结构化诊断信息
- **AND** 客户端 SHALL 能仅依赖该结果渲染连接器入口与错误提示

### Requirement: Vault 连接器必须先返回快照，再允许导入
系统 MUST 以“快照优先”的方式接入外部资料仓（如 Obsidian vault），而不是默认全量即时导入。

#### Scenario: 用户先预览连接器快照，再确认导入
- **WHEN** 用户为某个连接器 binding 请求快照
- **THEN** 系统 SHALL 返回可预览的文件快照
- **AND** 每个快照条目 SHALL 固定包含 `relative_path`、`size_bytes`、`modified_at`、`frontmatter_summary`
- **AND** `relative_path` SHALL 使用根目录相对路径与 `/` 分隔
- **AND** `frontmatter_summary` SHALL 只包含 `title`、`tags`、`aliases`、`date` 四个可选字段

### Requirement: 连接器必须使用 notebook-scoped binding 持久化状态
系统 MUST 使用 notebook-scoped connector binding 保存连接参数、导入范围与同步基线，而不是依赖无状态临时请求。

#### Scenario: 创建 binding 后执行后续动作
- **WHEN** 用户为某个 notebook 创建一个 connector binding
- **THEN** 系统 SHALL 持久化 `connector_id`、`connection_config`、`import_scope` 与 `last_confirmed_snapshot`
- **AND** 后续 `snapshot`、`import_scope`、`sync_check` SHALL 针对该 binding 执行

### Requirement: 连接器导入必须基于显式范围
连接器导入 MUST 支持选择性导入，而不是强制整库导入。

#### Scenario: 用户只导入大 vault 的一部分内容
- **WHEN** 一个 vault 含有大量笔记
- **AND** 用户仅选择其中一部分目录或文件
- **THEN** 系统 SHALL 只导入被选中的子集
- **AND** v1 的持久化导入范围 SHALL 固定为 `include_directories` 与 `include_files`
- **AND** 范围命中规则 SHALL 固定为“精确命中文件”或“位于目录前缀下”

### Requirement: 连接器同步检查必须显式且可复核
连接器同步 MUST 先执行 `sync_check`，再由用户确认增量变更，而不是静默地自动改写来源集合。

#### Scenario: sync_check 返回候选变更
- **WHEN** 用户对已连接的 binding 发起 `sync_check`
- **THEN** 系统 SHALL 返回 `新增`、`更新`、`缺失` 三类候选
- **AND** SHALL 在用户确认前不直接修改现有来源
- **AND** v1 SHALL NOT 因 `缺失` 候选自动删除现有来源

### Requirement: v1 sync_check 使用轻量快照差异规则
系统 MUST 使用确定性的轻量规则识别快照差异，以支持中大型 vault 的同步检查。

#### Scenario: sync_check 基于路径与文件属性判断变更
- **WHEN** 系统比较当前快照与上次已确认快照
- **THEN** 相同 `relative_path` 且 `size_bytes` 或 `modified_at` 变化的条目 SHALL 被标记为 `更新`
- **AND** 新出现的 `relative_path` SHALL 被标记为 `新增`
- **AND** 消失的 `relative_path` SHALL 被标记为 `缺失`
- **AND** v1 SHALL NOT 以全量文件哈希作为前置要求
