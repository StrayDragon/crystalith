# source-ingestion-core Specification (Delta)

## ADDED Requirements

### Requirement: Parser selection is deterministic and observable
系统 MUST 以确定性规则选择用于解析来源内容的 parser（优先已启用插件，其次 core 最小解析器）。

当多个插件 parser 同时命中同一输入时，系统 MUST 使用确定性 tie-break：
- 优先按 `plugins.load_order`（若配置）确定优先级
- 否则按 `plugin_id` 字典序确定优先级

系统 MUST 在来源元数据中记录所用 `parser_type`，并 SHOULD 记录 `parser_plugin_id`（若该 parser 来自插件）以便诊断与回归。

#### Scenario: Plugin parser takes precedence over core fallback
- **WHEN** 某文件类型同时匹配已启用的 parser 插件与 core 最小解析器
- **THEN** 系统 SHALL 优先使用插件 parser
- **AND** 创建的来源对象 SHALL 记录稳定的 `parser_type`

### Requirement: Core-only ingestion profile is minimal and explicit
在 core-only 安装形态下，系统 MUST 至少支持 txt/md/markdown/csv 的 ingestion；其他格式 MUST 被视为不可用增强能力（需通过插件安装/启用提供）。

#### Scenario: Core-only profile rejects non-core formats predictably
- **WHEN** 用户在 core-only 环境上传/导入一个非核心格式（例如 PDF/HTML/音视频）
- **THEN** 系统 SHALL 返回稳定的“不支持”语义
- **AND** SHALL 提供恢复提示（例如安装/启用对应 parser 插件）
