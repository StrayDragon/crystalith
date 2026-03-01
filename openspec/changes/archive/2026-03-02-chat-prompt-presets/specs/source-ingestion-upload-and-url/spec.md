## ADDED Requirements

### Requirement: Core upload supports CSV sources
系统的核心发行版 MUST 支持通过上传方式创建 CSV 来源：`.csv` 扩展名与 `text/csv` MIME MUST 被识别并由匹配 parser 处理。

#### Scenario: Uploading a CSV is accepted
- **WHEN** 用户上传一个 `.csv` 文件（`text/csv` 或扩展名 `.csv`）
- **THEN** 系统 SHALL 选择匹配的 parser 解析该文件
- **AND** 上传成功时 SHALL 返回 201 与创建的来源对象

### Requirement: CSV sources are chunked by rows to avoid oversized single chunks
系统 MUST 将 CSV 内容按行块切分为多个可索引 chunks，以避免单个超大 chunk 导致检索与引用不稳定。

#### Scenario: Large CSV produces multiple chunks
- **WHEN** 用户上传一个包含大量行的 CSV
- **THEN** 系统 SHALL 生成多个 chunk（每个 chunk 覆盖一段行范围）
- **AND** chunks SHALL 保持可检索与可引用（符合 ready 语义）
