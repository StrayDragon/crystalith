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
