# language: zh-CN
# capability: source-connectors
# purpose: 把外部知识源接入统一为宿主框架能力：连接器发现、notebook-scoped binding、快照优先与选择性导入、显式 sync_check 与确认应用边界，为后续官方/第三方 connectors 提供稳定宿主语义。
# scope: src/, tests/

功能: source-connectors

  @req:r46 @human
  场景: 连接器发现必须返回 notebook 作用域下的可用连接器
    - 系统 MUST 以 notebook 为作用域暴露当前可用的 source connectors、配置 schema 与诊断信息。

  @req:r104 @human
  场景: 连接器必须使用 notebook-scoped binding 持久化状态
    - 系统 MUST 使用 notebook-scoped connector binding 保存连接参数、导入范围与同步基线，而不是依赖无状态临时请求。

  @req:r141 @human
  场景: Vault 连接器必须先返回快照，再允许导入
    - 系统 MUST 以“快照优先”的方式接入外部资料仓（如 Obsidian vault），而不是默认全量即时导入。

  @req:r176 @human
  场景: 连接器导入必须基于显式范围
    - 连接器导入 MUST 支持选择性导入，而不是强制整库导入。

  @req:r208 @human
  场景: 连接器同步检查必须显式且可复核
    - 连接器同步 MUST 先执行 `sync_check`，再由用户确认增量变更，而不是静默地自动改写来源集合。

  @req:r236 @human
  场景: sync_check 使用轻量快照差异规则
    - 系统 MUST 使用确定性的轻量规则识别快照差异，以支持中大型 vault 的同步检查。

  @req:connector-binding-schema-validation @human
  场景: Connector binding creation MUST validate connectionConfig against JSON schema
    - 创建 connector binding 时 MUST 对 connectionConfig 做 JSON schema 校验，校验失败 MUST 返回 400（CONNECTOR_CONFIG_INVALID）

  @req:connector-unavailable-409 @human
  场景: Unavailable connector MUST return 409 with install hint
    - connector 不可用时 MUST 返回 409（CONNECTOR_UNAVAILABLE）含 hint 和 pluginDiagnostic，MUST NOT 返回 404

  @req:r46 @human
  场景: 前端加载-notebook-的连接器列表
    - 必须成立：当 客户端请求某个 notebook 的 source connectors；那么 系统 SHALL 返回该 notebook 可用的连接器描述、配置 schema 与结构化诊断信息
    当 客户端请求某个 notebook 的 source connectors
    那么 系统 SHALL 返回该 notebook 可用的连接器描述、配置 schema 与结构化诊断信息

  @req:r104 @human
  场景: 创建-binding-后执行后续动作
    - 必须成立：当 用户为某个 notebook 创建一个 connector binding；那么 系统 SHALL 持久化 `connectorId`、`connectionConfig`、`importScope` 与 `lastConfirmedSnapshot`
    当 用户为某个 notebook 创建一个 connector binding
    那么 系统 SHALL 持久化 `connectorId`、`connectionConfig`、`importScope` 与 `lastConfirmedSnapshot`

  @req:r141 @human
  场景: 用户先预览连接器快照-再确认导入
    - 必须成立：当 用户为某个连接器 binding 请求快照；那么 系统 SHALL 返回可预览的文件快照
    当 用户为某个连接器 binding 请求快照
    那么 系统 SHALL 返回可预览的文件快照

  @req:r176 @human
  场景: 用户只导入大-vault-的一部分内容
    - 必须成立：当 一个 vault 含有大量笔记；那么 系统 SHALL 只导入被选中的子集
    当 一个 vault 含有大量笔记
    那么 系统 SHALL 只导入被选中的子集

  @req:r208 @human
  场景: sync-check-返回候选变更
    - 必须成立：当 用户对已连接的 binding 发起 `sync_check`；那么 系统 SHALL 返回 `新增`、`更新`、`缺失` 三类候选
    当 用户对已连接的 binding 发起 `sync_check`
    那么 系统 SHALL 返回 `新增`、`更新`、`缺失` 三类候选

  @req:r236 @human
  场景: sync-check-基于路径与文件属性判断变更
    - 必须成立：当 系统比较当前快照与上次已确认快照；那么 相同 `relativePath` 且 `sizeBytes` 或 `modifiedAt` 变化的条目 SHALL 被标记为 `更新`
    当 系统比较当前快照与上次已确认快照
    那么 相同 `relativePath` 且 `sizeBytes` 或 `modifiedAt` 变化的条目 SHALL 被标记为 `更新`

  @req:connector-binding-schema-validation @human
  场景: invalid-config
    - 必须成立：假如 connectionConfig 不符合 schema；当 创建 binding；那么 系统 SHALL 返回 400 CONNECTOR_CONFIG_INVALID
    假如 connectionConfig 不符合 schema
    当 创建 binding
    那么 系统 SHALL 返回 400 CONNECTOR_CONFIG_INVALID

  @req:connector-unavailable-409 @human
  场景: connector-not-installed
    - 必须成立：假如 请求的 connector 未安装；当 客户端操作；那么 系统 SHALL 返回 409 含 hint 和 pluginDiagnostic
    假如 请求的 connector 未安装
    当 客户端操作
    那么 系统 SHALL 返回 409 含 hint 和 pluginDiagnostic
