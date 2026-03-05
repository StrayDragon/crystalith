# source-ingestion-upload-and-url Specification (Delta)

## ADDED Requirements

### Requirement: Unsupported formats are rejected with actionable diagnostics
当上传/URL 抓取的内容无匹配 parser（例如缺失对应插件）时，系统 MUST 返回 415 且 MUST 提供可机器读取的诊断信息（error_code/message/details），其中 details MUST 包含恢复提示（例如需要安装/启用的 `parser-*` 插件 id）。

#### Scenario: Uploading a PDF without parser plugin yields a hint
- **WHEN** 用户上传一个 PDF 且当前环境未安装/未启用 PDF parser 插件
- **THEN** 系统 SHALL 返回 415
- **AND** 响应 details SHALL 指出缺失的插件能力与恢复步骤（安装/启用对应插件）

### Requirement: Extractor selection errors are diagnosable
当用户在 fetch 模式显式指定某 extractor 但其不可用（未安装/禁用/依赖缺失/服务不可达）时，系统 MUST 返回稳定错误语义或按策略回退；无论哪种路径，系统 MUST 输出可诊断信息说明发生了什么与如何恢复。

#### Scenario: Preferred extractor unavailable is explained
- **WHEN** 用户指定 `preferred_extractor=X` 但 X 不可用
- **THEN** 系统 SHALL 返回明确的不可用原因（或在回退后返回回退链路的诊断信息）
- **AND** SHALL 提供可执行的恢复提示（启用插件/配置 endpoint/API key/稍后重试）

