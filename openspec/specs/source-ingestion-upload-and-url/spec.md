# source-ingestion-upload-and-url Specification

## Purpose

定义通过上传文件与 URL 创建来源的契约：格式支持、校验、异常语义、网页抓取安全与提取器策略。该规范强调输入错误可预测且安全默认值优先，避免在抓取路径引入 SSRF 风险。

## Non-goals

- 不定义来源列表/标签管理
- 不定义前端 Sources 面板布局

## Requirements

### Requirement: Upload endpoint returns created source on success
上传成功 MUST 返回 201 与来源对象；失败语义区分 400/415/500。

#### Scenario: Upload success returns created source
- **WHEN** 用户上传一个可解析且可索引的文件
- **THEN** 系统 SHALL 返回 201 与创建的来源对象

### Requirement: Supported formats are parser-driven
支持类型 MUST 由 parser 能力决定；无匹配 parser 的文件 MUST 返回 415 且不创建来源。

#### Scenario: Unsupported format is rejected
- **WHEN** 用户上传一个无匹配 parser 的文件
- **THEN** 系统 SHALL 返回 415 且不创建来源

### Requirement: Deterministic input errors do not create source rows
空文件或无可索引内容等确定性输入错误 MUST 返回 400 且不创建来源。

#### Scenario: Deterministic input error does not create source
- **WHEN** 用户上传空文件或无可索引内容的输入
- **THEN** 系统 SHALL 返回 400 且不创建来源

### Requirement: URL from-source supports link and fetch modes
`from-url` MUST 支持 `link|fetch`，`link` 不抓网页正文，`fetch` 抓取并分块。

#### Scenario: Link mode does not fetch content
- **WHEN** 用户使用 `from-url` 的 `link` 模式创建来源
- **THEN** 系统 SHALL 仅保存链接而不抓取网页正文

### Requirement: Fetch applies SSRF validation before network calls
`fetch` MUST 在请求前做 SSRF 校验并拒绝高风险目标（含逐跳重定向重验）。

#### Scenario: SSRF validation runs before fetch
- **WHEN** 用户使用 `fetch` 抓取一个高风险 URL（含重定向链）
- **THEN** 系统 SHALL 在网络请求前执行 SSRF 校验并拒绝不安全目标

### Requirement: Extractor preference, fallback, retry, and proxy are scoped
系统 MUST 支持提取器指定、可控 fallback、可重试错误重试、按提取器粒度代理配置。

#### Scenario: Extractor fallback is controlled
- **WHEN** 指定提取器失败且存在可控 fallback
- **THEN** 系统 SHALL 按策略回退并对可重试错误进行重试，同时保持代理配置按提取器粒度生效
