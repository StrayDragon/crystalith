# source-ingestion-url Specification

## Purpose

定义通过 URL 创建 Source 与网页提取器系统的契约：extractors 列表、`link|fetch` 两种 from-url 模式、可选 extractor 指定、自动降级与重试，以及提取器级代理配置。

## Related specs

- `GLOSSARY.md`
- `source-ingestion/spec.md`
- `source-ingestion-management/spec.md`
- `search-engine/spec.md`（`POST .../sources/search` 的搜索语义）
- `config-management/spec.md`（配置加载/示例）

## Requirements

### Requirement: List extractors
系统 MUST 提供 `GET /v1/notebooks/{notebook_id}/sources/extractors`，返回当前可用的网页提取器信息（用于前端展示与选择）：

- `extractors[]`：每项至少包含 `type, enabled, available, display_name, description, priority`
- `default_extractor`：第一个可用提取器（或 null）
- `fallback_enabled`：是否启用自动降级
`default_extractor` MUST 为 fallback 顺序中第一个 `available=true` 的 type。

### Requirement: Create source from URL supports link/fetch modes
系统 MUST 提供 `POST /v1/notebooks/{notebook_id}/sources/from-url`，body 至少包含：

- `url`（必须以 `http://` 或 `https://` 开头）
- `mode: link|fetch`
- 可选：`title`, `snippet`, `extractor`
当 `mode = link` 时系统 MUST 创建轻量 Source（仅保存 url/title/snippet 的合成内容），`parser_type = "link"`，且 MUST NOT 触发网页内容下载。

当 `mode = fetch` 时系统 MUST 在任何网络请求发生前执行 SSRF 安全校验（拒绝 localhost/私网/元数据地址等高风险目标）；校验失败 MUST 返回 400 且 MUST NOT 创建 Source 记录。
校验通过后系统 MUST 使用网页提取器获取正文并分块后创建完整 Source；`parser_type` 形如 `web:<extractor_type>`，且 Source.metadata MUST 包含提取元数据（extractor/time/original_url/page_title...）。

### Requirement: URL fetch MUST apply SSRF safety validation
系统 MUST 在 `from-url(fetch)` 的 `url` 上执行 SSRF 安全校验，并拒绝高风险目标：

- MUST 拒绝 `localhost`、loopback、link-local、RFC1918 私网、以及云元数据地址（例如 `169.254.169.254`）
- MUST 拒绝包含 userinfo（如 `user:pass@host`）的 URL
- MUST 对 hostname 进行 DNS 解析；若解析得到的任一 IP 属于被拒绝网段，则 MUST 拒绝
- 校验失败时 MUST 返回 400，且 MUST NOT 发起任何网络请求，且 MUST NOT 创建 Source 记录

### Requirement: Redirects MUST be revalidated per hop
系统 MUST 在抓取时对每一次重定向的 `Location` 目标执行与初始 URL 等价的 SSRF 校验，并限制最大重定向次数。
若任一跳重定向目标未通过校验，系统 MUST 返回 400 且停止跟随，并且 MUST NOT 创建 Source 记录。

### Requirement: Allowlist MAY explicitly permit safe internal targets
系统 MUST 提供显式 allowlist 配置以支持受控环境下抓取特定内部站点：

- allowlist 命中的目标 MUST 允许通过校验
- 非 allowlist 目标仍 MUST 按默认策略拒绝私网/localhost/元数据等

配置字段在 `source_ingestion.url_fetch.security.*` 下，且默认值 MUST 为“安全拒绝”。

### Requirement: Extractor preference and fallback
系统 MUST 支持客户端指定 `extractor`，并在启用 fallback 时按配置顺序自动降级。
客户端指定 `extractor` 时系统 MUST 优先尝试该提取器；当启用 fallback 且首选提取器失败时 MUST 尝试后续提取器。客户端提交未知 extractor 值 MUST 返回 400（无效提取器类型）。

### Requirement: Retryable extraction errors are retried
系统 SHOULD 对可重试的提取错误（网络/超时/短暂服务不可用）按 `ai.max_retries` 执行重试。
当最终失败（所有可用提取器都失败）时系统 MUST 返回 400（无法提取网页内容），且 MUST NOT 创建 Source 记录。

### Requirement: Fetch chunking is CPU-safe
系统 MUST 在 fetch 模式下对提取文本进行分块，并避免阻塞事件循环（例如在 executor 中执行分块）。
分块 SHOULD 在 executor 中执行；若分块结果为空则 MUST 返回 400（网页中未提取到有效内容）。

### Requirement: Proxy configuration is extractor-scoped
系统 MUST 支持为网页提取器配置可选 HTTP 代理（HTTP/HTTPS/SOCKS5），并以提取器为粒度启用：

- `source_ingestion.web_extraction.trafilatura.proxy`
- `source_ingestion.web_extraction.jina.proxy`

说明：配置 Schema 中的 `source_ingestion.url_fetch.proxy` 当前未被 `from-url(fetch)` 路径使用，可视为保留字段；`source_ingestion.url_fetch.security` 用于 SSRF 防护与重定向逐跳重验。
未配置 extractor proxy 或 `enabled=false` 时系统 MUST 不使用代理；当 `enabled=true` 且配置了 `socks5_url` 时系统 SHOULD 优先使用 SOCKS5 代理。

### Requirement: Source search endpoint returns message and results
系统 MUST 提供 `POST /v1/notebooks/{notebook_id}/sources/search`，返回 `SourceSearchResponse`：

- `results[]`：`{title,url,snippet,source?}`
- `message`：可选摘要 message（失败时为空字符串）

搜索引擎与摘要语义见 `search-engine/spec.md`。
