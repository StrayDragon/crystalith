# source-ingestion-upload-and-url 规范增量

## ADDED Requirements

### Requirement: Oversized Uploads MUST Be Rejected Deterministically with 413
当 HTTP guardrails 启用且配置了上传上限时，上传接口 MUST 对单次上传施加 `upload_max_bytes` 限制；超过上限 MUST 返回 413，且 MUST 不创建来源记录。

#### Scenario: Upload larger than max_bytes returns 413 and does not create source
- **WHEN** guardrails 启用
- **AND** 用户上传文件大小超过 `upload_max_bytes`
- **THEN** 系统 SHALL 返回 413
- **AND** 响应 MUST 使用统一错误信封
- **AND** 系统 SHALL 不创建 Source 行（与“确定性输入错误不落库”一致）
