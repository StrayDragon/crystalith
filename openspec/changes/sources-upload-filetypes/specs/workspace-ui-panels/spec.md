## ADDED Requirements

### Requirement: Sources upload file type support is consistent and includes PDF
Workspace 的 Sources 上传入口 MUST 支持后端核心发行版的常见内置解析格式，且前端 `accept`、预过滤与提示文案 MUST 保持一致。
该支持集 SHALL 至少包含：`.txt/.md/.markdown` 与 `.pdf`（`application/pdf`）。

#### Scenario: Uploading a PDF is accepted by the UI
- **WHEN** 用户在 Sources 面板通过“选择文件”或“拖拽”方式上传 `.pdf`
- **THEN** UI SHALL 接受该文件并进入上传队列
- **AND** 不应出现“文件类型不支持”的过滤提示

#### Scenario: Unsupported formats are rejected with clear feedback
- **WHEN** 用户上传一个明确不支持的格式（如 `.docx`）
- **THEN** UI SHALL 拒绝该文件
- **AND** 提供清晰、与支持集一致的提示信息
