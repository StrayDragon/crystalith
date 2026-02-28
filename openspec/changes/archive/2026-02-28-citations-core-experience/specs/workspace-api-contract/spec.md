## ADDED Requirements

### Requirement: Citation fields are stable across APIs
citation 对象 MUST 在 QA/messages/outputs 等对外 API 中保持字段语义一致，并包含最小可定位字段集。

#### Scenario: Citations include required fields
- **WHEN** 任一端点返回 citation 对象
- **THEN** citation SHALL 至少包含 `source_id`, `source_name`, `chunk_id`, `chunk_index`, `snippet`
- **AND** `chunk_index` SHALL 表示在该 source 内的稳定顺序（1-based）

### Requirement: Citation context lookup is supported
系统 MUST 提供可按 citation 定位并获取上下文的稳定端点，以支持用户复查证据链。

#### Scenario: Fetch citation context
- **WHEN** 客户端请求某 citation 的上下文
- **THEN** 系统 SHALL 返回片段前后文（或等价上下文）与页码/段落等元信息（如可用）

### Requirement: Exports can include citations
系统 MUST 支持将 QA/Outputs 导出为包含 citations 的格式（Markdown/JSON 或等价），以便分享与复盘。

#### Scenario: Export includes citation list
- **WHEN** 用户导出 QA 或某个 Output
- **THEN** 导出结果 SHALL 包含引用清单与可定位信息（source_id 或可解析来源标识）
