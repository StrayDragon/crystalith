## 背景

Crystalith 当前已经具备稳定的单文件上传、URL 导入、parser plugin 发现和 source metadata 存储能力。对于 Obsidian，最合理的演进路径不是“做一个专用批量上传功能”，而是：

1. **Markdown 语义兼容层**：普通 `.md` 上传也能理解 Obsidian 的 `wikilink`、`embed`、`frontmatter`
2. **宿主内置 source connector framework**：提供连接器通用的后端模型与前端工作流壳子
3. **Obsidian 官方插件**：作为 framework 的第一个官方实现，验证大 vault 的选择性导入与同步检查

本次变更先完成第 1 层，并把第 2/3 层的接口与边界定义清楚。

## 已确定决策

### D1：Obsidian 不是“特制流程”，而是“框架上的第一个插件”
- 不再以“给 Obsidian 单独做一套上传功能”为目标。
- 宿主先提供通用连接器框架；Obsidian 只是首个官方连接器插件。
- 后续 Git 文档仓、本地 Markdown 仓、其他知识源应复用同一套框架。

### D2：宿主默认提供通用连接器工作流壳子
- 宿主内置以下通用交互能力：
  - 连接参数表单
  - vault / 仓库快照预览
  - 目录 / 文件范围选择
  - `sync_check` 结果展示
  - 导入进度、错误与恢复提示
- v1 中插件不实现上述通用 UI。
- v1 不支持 connector plugin 提供自定义前端工作流；快照 / 范围 / 同步确认流程完全由宿主负责。

### D3：v1 采用 notebook-scoped connector binding 模型
- 每个连接器实例以 `connector binding` 形式持久化到 notebook 下。
- 一个 binding 固定包含：
  - `connector_id`
  - `connection_config`
  - `import_scope`
  - `last_confirmed_snapshot`
  - `last_sync_check_result`（可为空）
- `sync_check` 永远针对某个已保存 binding 执行，而不是无状态临时请求。

### D4：v1 的 API 家族固定为 5 组动作
- `GET /v1/notebooks/{notebook_id}/source-connectors`
  - 列出当前可用连接器及其诊断信息
- `POST /v1/notebooks/{notebook_id}/source-connectors/{connector_id}/bindings`
  - 创建 binding，并保存 `connection_config`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/snapshot`
  - 基于 binding 配置返回当前快照
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/import-scope`
  - 保存范围并导入命中的文件
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/sync-check`
  - 基于已保存 binding 与上次已确认快照返回候选变更

v1 不再在实现阶段重新讨论是否需要新的 discovery path 或是否采用完全无状态接口。

### D5：v1 采用“快照优先 + 选择性导入”
- 连接器首先返回快照，而不是直接导入。
- v1 的快照条目固定包含：`relative_path`、`size_bytes`、`modified_at`、`frontmatter_summary`。
- `relative_path` 一律使用 vault 根目录相对路径，并统一为 `/` 分隔，不允许绝对路径、`..` 或 `./` 前缀。
- `modified_at` 固定为 ISO 8601 字符串。
- `frontmatter_summary` 只允许包含 `title`、`tags`、`aliases`、`date` 四个可选字段。
- 用户在导入前只可按**目录**和**文件**选择范围。
- `frontmatter.tags` 在 v1 只用于展示与筛选提示，不作为持久化的导入范围规则。

### D6：导入范围模型在 v1 固定为显式路径规则
- 持久化导入范围只允许两类规则：
  - `include_directories: string[]`
  - `include_files: string[]`
- 文件命中范围的条件固定为：
  - 路径精确匹配 `include_files`，或
  - 路径位于任一 `include_directories` 前缀下
- 导入请求至少需要一个非空范围规则。
- v1 不支持排除规则、不支持按 tag 持久化选范围。

### D7：v1 的同步是“显式同步检查”，不是后台自动同步
- v1 不做常驻 watcher，不做 OS 级文件监听，不做静默自动落库。
- v1 的同步入口固定为 `sync_check`：重新读取快照，并给出“新增 / 更新 / 缺失”候选。
- 只有在用户确认后，系统才执行增量导入。
- 对于“缺失”候选，v1 只做提示与确认展示，不在本次变更中自动删除现有来源。
- “自动同步检查”在 v1 的含义仅限于未来可扩展为定时触发 `sync_check`；本次变更不实现调度器。

### D8：同步差异判定规则在 v1 固定为轻量快照比对
- 同一个条目的稳定标识使用 `relative_path`。
- 若同一路径的 `size_bytes` 或 `modified_at` 发生变化，则视为“更新候选”。
- 若新路径出现在当前快照但不在上次已确认快照中，则视为“新增候选”。
- 若上次已确认快照中的路径在当前快照中消失，则视为“缺失候选”。
- v1 的 `sync_check` 不要求预先读取全部文件内容做哈希比较。

### D9：Markdown 兼容能力先下沉到通用上传链路
- 普通 `.md` 上传先支持：
  - `[[page]]` / `[[page|alias]]` 转为标准 Markdown 链接
  - `![[file]]` / `![[file|alias]]` 转为文本引用
  - YAML frontmatter 提取到 `source.metadata.frontmatter`
- 这样未来无论是手动上传、connector plugin 还是其他 parser/plugin，都能复用同一套语义清洗能力。

## 宿主对象模型（v1）

本节用于把 `connector / binding / snapshot / import_scope / sync_check` 的宿主对象模型收口为可实现的最小集合，避免后续实现阶段再次发散。

### SourceConnectorDescriptor（连接器描述）

宿主对外暴露的连接器列表条目（用于渲染入口与表单）：

```yaml
SourceConnectorDescriptor:
  connector_id: string
  display_name: string
  description: string | null
  connection_config_schema: object      # JSON Schema（由插件提供）
  diagnostics: list[Diagnostic] | null  # 由插件提供的结构化诊断（例如“vault 路径不可读”）
  capabilities:
    supports_snapshot: bool
    supports_sync_check: bool
```

### ConnectorBinding（notebook-scoped 持久化绑定）

```yaml
ConnectorBinding:
  id: string
  notebook_id: string
  connector_id: string
  connection_config: object            # 以 schema 校验后的配置对象
  import_scope: ImportScope | null
  last_confirmed_snapshot: Snapshot | null
  last_sync_check_result: SyncCheckResult | null
  created_at: time
  updated_at: time
```

- `binding` 的持久化边界是 notebook：同一 notebook 下可存在多个 bindings（不同 connector 或同一 connector 的不同配置实例）。
- v1 不要求跨 notebook 共享 binding（后置项）。

### Snapshot（快照）与条目

快照是“某次枚举的可预览结果”，用于范围选择与同步基线：

```yaml
Snapshot:
  generated_at: time
  entries: list[SnapshotEntry]

SnapshotEntry:
  relative_path: string                # 根目录相对路径，统一用 "/" 分隔
  size_bytes: int
  modified_at: string                  # ISO 8601
  frontmatter_summary:
    title: string | null
    tags: list[string] | null
    aliases: list[string] | null
    date: string | null
```

路径规范化规则（宿主强制）：

- `relative_path` MUST 为相对路径；SHALL NOT 含 `..`、`./`、绝对路径前缀。
- 分隔符统一为 `/`；宿主负责对插件返回值做规范化与拒绝非法路径。

### ImportScope（选择性导入范围）

```yaml
ImportScope:
  include_directories: list[string] | null
  include_files: list[string] | null
```

- 范围命中规则固定为：
  - `relative_path` 精确命中 `include_files`，或
  - `relative_path` 位于任一 `include_directories` 的前缀之下
- `include_directories/include_files` 至少其一非空；v1 不支持排除规则与基于 tags 的持久化范围。

### SyncCheckResult（显式同步检查结果）

`sync_check` 的目标是“给出候选差异 + 等用户确认再应用”，而不是静默同步：

```yaml
SyncCheckResult:
  id: string
  checked_at: time
  base_snapshot: Snapshot | null        # 上次已确认快照（可能为空：首次接入）
  current_snapshot: Snapshot
  candidates:
    added: list[SyncCandidate]
    updated: list[SyncCandidate]
    missing: list[SyncCandidate]

SyncCandidate:
  relative_path: string
  current: SnapshotEntry | null         # missing 时为空
  base: SnapshotEntry | null            # added 时为空
  reason: string | null                 # 轻量解释（例如“modified_at 变化”）
```

确认应用边界（v1）：

- `sync_check` 返回候选集合，但 **不会** 在未确认前修改现有来源。
- “确认应用”属于 `sync_check` 家族的第二阶段动作（路由命名可在实现阶段细化，但不得引入新的动作家族）。
- v1 对 `missing` 只做提示与显式确认展示：不自动删除；是否支持“标记忽略/确认缺失”后置。

## 接口草图

```text
host source connector framework
        │
        ├─ list connectors
        ├─ create binding
        ├─ snapshot(binding)
        ├─ import_scope(binding)
        └─ sync_check(binding)

connector plugin
        │
        ├─ enumerate snapshot entries
        ├─ read file contents
        ├─ expose connection config schema
        └─ return connector-specific diagnostics

core source ingestion
        │
        ├─ parser resolution
        ├─ markdown preprocessing（已实现）
        ├─ chunk / embed / store
        └─ source metadata / diagnostics
```

## 插件作者边界

- 插件作者必须负责：
  - 外部资料枚举
  - 内容读取
  - 连接参数 schema
  - connector-specific 诊断信息
- 插件作者不负责：
  - 快照列表 UI
  - 范围选择 UI
  - 同步检查对比 UI
  - 导入进度 UI
- v1 中插件不提供前端工作流扩展；连接器前端流程完全由宿主统一实现。

## 非目标

- 本次变更不实现后台常驻同步进程
- 本次变更不实现按 tag 作为持久化同步规则
- 本次变更不实现缺失来源的自动删除
- 本次变更不允许插件各自替换整套连接器工作流 UI
- 本次变更不为 Obsidian 单独新增 parser 类型；优先复用 core Markdown ingestion 能力
