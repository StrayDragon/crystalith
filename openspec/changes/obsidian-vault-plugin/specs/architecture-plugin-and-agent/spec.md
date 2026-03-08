# architecture-plugin-and-agent 规范增量

## ADDED Requirements

### Requirement: 宿主必须支持 SourceConnectorPlugin 作为一等插件接口
宿主 MUST 将 `SourceConnectorPlugin` 作为与 `ParserPlugin`、`OutputTypePlugin`、`WebExtractorPlugin` 并列的一类插件接口，纳入统一的发现、兼容性门禁、启用策略与诊断失败语义。

#### Scenario: 系统启动时发现 source connector 插件
- **WHEN** 系统启动并扫描 `crystalith.plugins` entry points
- **THEN** 实现 `SourceConnectorPlugin` 的插件 SHALL 被识别为 source connector 候选
- **AND** SHALL 应用与其他插件一致的 `api_version` / enablement / load error 校验

### Requirement: Source connector 插件默认复用宿主工作流壳子
宿主 MUST 为 source connector 插件提供默认的连接器工作流壳子，以避免每个插件重复开发同类 UI 与流程。

#### Scenario: 插件声明连接器能力但未提供自定义前端
- **WHEN** 一个 `SourceConnectorPlugin` 只声明连接参数、快照能力和同步能力
- **THEN** 宿主 SHALL 仍能使用内置工作流完成快照预览、范围选择、同步检查与导入确认
- **AND** v1 中插件 SHALL NOT 自带或替换整套连接器前端工作流
