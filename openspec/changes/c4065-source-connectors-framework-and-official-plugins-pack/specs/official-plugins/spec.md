# official-plugins 规范增量

## ADDED Requirements

### Requirement: Official Source Connector Pack MUST Validate the Host Framework
系统 MUST 提供一组官方 source connectors 来验证宿主框架在文件源、feed 源与 secrets 场景下都可复用。

#### Scenario: 官方 connector pack 覆盖多种输入形态
- **WHEN** 自托管或开发环境安装官方 source connectors pack
- **THEN** 系统 SHALL 至少提供 local-directory、obsidian-vault、rss/atom 与 imap-email 四类 connectors
- **AND** 它们 SHALL 复用同一套宿主 binding/preflight/snapshot/sync_check 语义

### Requirement: Official Connector Catalog MUST Expose Install and Recovery Hints
系统 MUST 在官方插件 catalog 中暴露 source connector pack 的安装、启用与恢复提示。

#### Scenario: 某个官方 connector 未安装或加载失败
- **WHEN** 客户端查看 official plugin diagnostics
- **THEN** 系统 SHALL 返回对应 connector plugin 的 status 与 hint
- **AND** SHALL 能区分 `not_installed`、`skipped` 与 `loaded`

### Requirement: Secrets-bearing Official Connectors MUST Be Redacted by Default
带 secrets 的官方 connectors MUST 在日志、diagnostics 与导出包中默认脱敏。

#### Scenario: IMAP connector 导出 diagnostics
- **WHEN** 用户导出 IMAP connector 的 diagnostics
- **THEN** 系统 SHALL 不暴露用户名以外的敏感连接信息明文
- **AND** SHALL 仍保留足够的结构化错误上下文用于恢复
