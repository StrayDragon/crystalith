# language: zh-CN
# capability: source-connectors
# purpose: 把外部知识源接入统一为宿主框架能力：连接器发现、notebook-scoped binding、快照优先与选择性导入、显式 sync_check 与确认应用边界，为后续官方/第三方 connectors 提供稳定宿主语义。

功能: source-connectors

  @req:r245
  规则: 连接器发现必须返回 notebook 作用域下的可用连接器
    系统 MUST 以 notebook 为作用域暴露当前可用的 source connectors、配置 schema 与结构化诊断信息。

    场景: discovery-returns-notebook-scoped-connectors
      假如 一个空白笔记本
      当 发送 GET 请求"/v2/notebooks/{当前笔记本[id]}/source-connectors"
      那么 响应状态码为200
      而且 响应 connectors 中每个条目都带 connectorId、connectionConfigSchema 与 diagnostics
  @req:r246
  规则: 连接器必须使用 notebook-scoped binding 持久化状态
    系统 MUST 使用 notebook-scoped connector binding 持久化 `connectorId`、`connectionConfig`、`importScope` 与同步基线 `lastConfirmedSnapshot`，而不是依赖无状态临时请求。

    场景: binding-persisted-notebook-scoped
      假如 一个空白笔记本
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/source-connectors/vault/bindings"，内容为合法 connectionConfig
      那么 响应状态码为201 且返回含 connectorId、connectionConfig、importScope 的绑定对象
      而且 后续快照与 sync-check 仅凭 notebookId 与 bindingId 即可复用该持久化配置
  @req:r247
  规则: Vault 连接器必须先返回快照，再允许导入
    系统 MUST 以“快照优先”的方式接入外部资料仓（如 Obsidian vault）：用户请求快照时 SHALL 返回可预览的文件快照，而不是默认全量即时导入。

    场景: vault-snapshot-before-import
      假如 一个空白笔记本
      而且 已创建指向临时 vault 目录的连接器绑定
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/source-connector-bindings/{当前绑定[id]}/snapshot"
      那么 响应状态码为200 且返回可预览的文件快照
      而且 请求快照本身不创建任何来源
  @req:r248
  规则: 连接器导入必须基于显式范围
    连接器导入 MUST 支持选择性导入：即使 vault 含有大量笔记，系统也 SHALL 只导入被选中的子集，而不是强制整库导入。

    场景: import-only-selected-scope
      假如 已创建指向含多篇笔记的 vault 目录的连接器绑定
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/source-connector-bindings/{当前绑定[id]}/import-scope"，内容为仅选中部分笔记的导入范围
      那么 响应状态码为200 且仅选中的笔记成为来源
      而且 未选中的 vault 笔记不出现在来源列表中
  @req:r249
  规则: 连接器同步检查必须显式且可复核
    连接器同步 MUST 先执行 `sync_check` 返回新增、更新、缺失三类候选变更，再由用户确认后增量应用，而不是静默地自动改写来源集合。

    场景: sync-check-explicit-apply
      假如 已创建连接器绑定且 vault 中新增一篇笔记
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/source-connector-bindings/{当前绑定[id]}/sync-check"
      那么 响应状态码为200 且返回新增、更新、缺失三类候选变更
      而且 在调用 sync-check/apply 确认前来源集合保持不变
  @req:r250
  规则: sync_check 使用轻量快照差异规则
    系统 MUST 使用确定性的轻量规则识别快照差异（如相同 `relativePath` 且 `sizeBytes` 或 `modifiedAt` 变化的条目标记为更新），以支持中大型 vault 的同步检查。
  
    场景: snapshot-diff-is-lightweight-and-deterministic
      假如 有一份 base 快照与一份 current 快照（tests/studio/deferred-lock.test.ts）
      当 执行 buildSyncCandidates
      那么 相同 relativePath 且 sizeBytes/modifiedAt 变化的条目标记为 updated（含原因文案）、新增/消失分别进入 added/missing
      而且 候选按 relativePath 排序输出（确定性）

@req:r251
  规则: Connector binding creation MUST validate connectionConfig against JSON schema
    创建 connector binding 时 MUST 对 connectionConfig 做 JSON schema 校验，校验失败 MUST 返回 400（CONNECTOR_CONFIG_INVALID）

    场景: binding-config-schema-validation
      假如 一个空白笔记本
      当 发送 POST 请求"/v2/notebooks/{当前笔记本[id]}/source-connectors/vault/bindings"，内容缺少 schema 必填的 vaultPath
      那么 响应状态码为400
      而且 错误信息点名缺失的配置字段且不创建绑定
  @req:r252
  规则: Unavailable connector MUST return 409 with install hint
    connector 不可用时 MUST 返回 409（CONNECTOR_UNAVAILABLE）含 hint 和 pluginDiagnostic，MUST NOT 返回 404

    场景: unavailable-connector-409-with-hint
      假如 集成环境就绪（tests/studio/deferred-lock.test.ts）
      当 对不存在的 connectorId 创建绑定
      那么 409 CONNECTOR_UNAVAILABLE 且 details 携带 hint 与 pluginDiagnostic{connectorId, loaded:false}

