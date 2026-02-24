# source-ingestion-url (delta) Specification

## ADDED Requirements

### Requirement: URL fetch MUST apply SSRF safety validation
系统 MUST 在任何网页抓取发生前对 `from-url(fetch)` 的 `url` 执行 SSRF 安全校验，并拒绝高风险目标：

- MUST 拒绝 `localhost`、loopback、link-local、RFC1918 私网、以及云元数据地址（例如 `169.254.169.254`）
- MUST 拒绝包含用户凭证（userinfo，如 `user:pass@host`）的 URL
- MUST 对 hostname 进行 DNS 解析；若解析得到的任一 IP 属于被拒绝网段，则 MUST 拒绝
- 校验失败时 MUST 返回 400，且 MUST NOT 发起任何网络请求，且 MUST NOT 创建 Source 记录

#### Scenario: Blocked private network target
- **WHEN** 客户端提交的 `url` 解析或 DNS 解析结果指向私网/loopback/link-local/元数据地址
- **THEN** 系统返回 400 且不发起网络请求，并且不创建 Source

### Requirement: Redirects MUST be revalidated per hop
系统 MUST 在抓取时对每一次重定向的 `Location` 目标执行与初始 URL 等价的 SSRF 校验，并限制最大重定向次数。

#### Scenario: Redirect chain attempts to reach private IP
- **WHEN** 初始 URL 可通过校验，但响应重定向到私网/localhost/元数据地址
- **THEN** 系统在该跳重定向处返回 400 且停止跟随，并且不创建 Source

### Requirement: Allowlist MAY explicitly permit safe internal targets
系统 MUST 提供显式 allowlist 配置以支持受控环境下抓取特定内部站点；当 allowlist 启用时：

- allowlist 命中的目标 MUST 允许通过校验
- 非 allowlist 目标仍 MUST 按默认策略拒绝私网/localhost/元数据等

#### Scenario: Allowlisted hostname is permitted
- **WHEN** URL host 命中显式 allowlist
- **THEN** 系统允许抓取继续执行

## MODIFIED Requirements

### Requirement: Create source from URL supports link/fetch modes
系统 MUST 提供 `POST /v1/notebooks/{notebook_id}/sources/from-url`，body 至少包含：

- `url`（必须以 `http://` 或 `https://` 开头）
- `mode: link|fetch`
- 可选：`title`, `snippet`, `extractor`

当 `mode = link` 时系统 MUST 创建轻量 Source（仅保存 url/title/snippet 的合成内容），`parser_type = "link"`，且 MUST NOT 触发网页内容下载。

当 `mode = fetch` 时系统 MUST 先执行 URL 安全校验（见 SSRF 相关要求）；校验通过后 MUST 使用网页提取器获取正文并分块后创建完整 Source；`parser_type` 形如 `web:<extractor_type>`，且 Source.metadata MUST 包含提取元数据（extractor/time/original_url/page_title...）。

#### Scenario: Link mode does not perform network fetch
- **WHEN** 客户端提交 `mode="link"`
- **THEN** 系统创建轻量 Source 且不发起任何网络请求

#### Scenario: Fetch mode rejects unsafe URL
- **WHEN** 客户端提交 `mode="fetch"` 且 URL 未通过 SSRF 安全校验
- **THEN** 系统返回 400 且不创建 Source
