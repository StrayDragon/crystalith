## Context

- `POST /v1/notebooks/{notebook_id}/sources/from-url` 的 `fetch` 模式会触发后端对用户输入的 URL 进行抓取与内容提取。
- 当前 URL 校验仅限制 `http(s)://` 前缀，缺少对 `localhost`/私网/元数据地址等 SSRF 目标的拦截；提取器内部也会跟随重定向，且重定向目标未再次校验。
- 上传导入路径对“空文件/空内容”等确定性用户错误缺少 4xx 映射，且容易创建无意义的失败 Source 记录，影响 UI 与排障信噪比。

## Goals / Non-Goals

**Goals:**
- 为 `from-url(fetch)` 引入 SSRF 防护：阻止 loopback/link-local/RFC1918/元数据等目标，并对重定向链路逐跳校验。
- 提供可控的 allowlist 放行机制（默认安全拒绝），满足受控内网部署的合法需求。
- 将确定性用户错误（空文件/空内容/不安全 URL/无效 extractor）稳定映射到 4xx，并尽量避免创建 Source 记录。
- 增加覆盖上述行为的自动化测试，并在 tasks 中提供“部署后用 DevTools 验证”的手册步骤。

**Non-Goals:**
- 本变更不引入用户认证/授权（该问题独立处理）。
- 不追求一次性完全消除所有 DNS rebinding 形式的 SSRF（需要更深的连接绑定/自定义 transport）；本次以“DNS 解析校验 + 每次重定向再校验 + 禁止可疑 URL 形态”为主要防线。
- 不改变提取器选择/降级与重试的总体语义（除非为 SSRF/重定向校验所必须）。

## Decisions

### 1) SSRF 校验作为共享能力（而非仅在某个 extractor 内）
**Decision:** 新增共享的 URL 安全校验模块（例如 `shared/net/url_safety.py`），并在 `from-url(fetch)` 路径进入“任何网络请求之前”调用；同时对重定向 `Location` 逐跳复用同一校验逻辑。

**Rationale:** 避免不同 extractor/调用路径各自实现校验导致覆盖不全或行为分叉；也便于单测与未来扩展（CIDR allowlist、策略开关等）。

### 2) 主动接管重定向以保证“每跳重验”
**Decision:** 将抓取实现从 `follow_redirects=True` 调整为手动跟随（`follow_redirects=False`），对每一个 `Location` 生成的新 URL 执行同样的 SSRF 校验，并限制最大跳数。

**Rationale:** 自动重定向无法在每跳插入校验，容易被用于绕过（例如从公网域名 302 到内网地址）。

### 3) 配置策略：默认安全拒绝 + 显式 allowlist
**Decision:** 在配置中提供 SSRF 相关策略字段（默认拒绝私网/localhost/元数据）。当部署方明确配置 allowlist（域名/后缀/可选 CIDR）时，才允许访问被放行目标。

**Rationale:** SSRF 的安全默认值应为“拒绝高风险目标”；allowlist 可覆盖合法场景，同时降低误放行风险。

### 4) 错误处理分层：用户错误 4xx、运行时失败 5xx
**Decision:** ingestion 端点的 `try/except` 仅将“未知运行时异常”转换为 500；对 `HTTPException`（尤其 4xx）必须原样抛出；对已知的输入错误（例如空文件/空 chunks）统一映射为 400，并尽量在创建 Source 记录之前返回。

**Rationale:** 让前端可区分用户问题与服务端问题；避免 sources 列表被无意义的失败记录污染；同时保持对真实运行时失败的可观测性（失败 Source + error_message）。

## Risks / Trade-offs

- **[风险]** 默认拦截可能会阻止之前“看似可用”的内网抓取用例 → **缓解**：提供 allowlist 配置与清晰错误信息，并在部署文档中明确风险与配置方式。
- **[风险]** DNS 解析/校验增加延迟 → **缓解**：使用异步 `getaddrinfo`（线程池），设置超时与缓存（如必要），并将校验失败视为 4xx 快速返回。
- **[风险]** 仍存在理论上的 DNS rebinding 窗口 → **缓解**：逐跳重定向重验；未来可在需要时引入自定义 transport/连接绑定作为增强项。

## Migration Plan

1. 合并并部署后端变更（默认安全拒绝策略生效）。
2. 若部署环境需要抓取内网站点，在 `config/app.yaml` 中显式配置 allowlist 并重新生成 schema（如字段有新增）。
3. 回滚策略：回滚到上一版本或在配置层关闭/放宽策略（仅用于紧急恢复，需评估风险）。

## Open Questions

- allowlist 的最小可用形态：仅域名/后缀，还是同时支持 CIDR？
- 对 `http://` 的支持是否需要进一步收紧（例如仅允许 https，或对 http 目标额外提示）？
