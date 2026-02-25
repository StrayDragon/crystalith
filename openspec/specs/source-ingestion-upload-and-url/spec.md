# source-ingestion-upload-and-url Specification

## Purpose

定义通过上传文件与 URL 创建来源的契约：格式支持、校验、异常语义、网页抓取安全与提取器策略。

## Non-goals

- 不定义来源列表/标签管理
- 不定义前端 Sources 面板布局

## Requirements

### Requirement: Upload endpoint returns created source on success
上传成功 MUST 返回 201 与来源对象；失败语义区分 400/415/500。

### Requirement: Supported formats are parser-driven
支持类型 MUST 由 parser 能力决定；无匹配 parser 的文件 MUST 返回 415 且不创建来源。

### Requirement: Deterministic input errors do not create source rows
空文件或无可索引内容等确定性输入错误 MUST 返回 400 且不创建来源。

### Requirement: URL from-source supports link and fetch modes
`from-url` MUST 支持 `link|fetch`，`link` 不抓网页正文，`fetch` 抓取并分块。

### Requirement: Fetch applies SSRF validation before network calls
`fetch` MUST 在请求前做 SSRF 校验并拒绝高风险目标（含逐跳重定向重验）。

### Requirement: Extractor preference, fallback, retry, and proxy are scoped
系统 MUST 支持提取器指定、可控 fallback、可重试错误重试、按提取器粒度代理配置。
