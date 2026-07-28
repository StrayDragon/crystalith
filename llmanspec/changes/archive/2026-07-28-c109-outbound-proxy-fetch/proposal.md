---
depends_on: []
status: designed
branch: sdd/c109-outbound-proxy-fetch
base_sha: 5851bbd259781abcf768356f1c19c6831f61b6e5
checkpointed: true
checkpoint_sha: 5851bbd259781abcf768356f1c19c6831f61b6e5
---

## Why

`config/app.yaml` 已有全局 `proxy_settings`，且 URL/extractor 段落复用了 YAML anchor，但 **服务端出站几乎全是裸 `fetch()`**（Firecrawl / Jina / SearXNG / `fetchWithRedirectGuard` 等），代理从未接线。访问官方 Firecrawl 等外网设施时无法可选走代理。

需要把「可选代理」做成 **固定出站合约**，避免未来新中间件/工具再次直连 `fetch`。

## What Changes

1. **SSOT**：新增 `apps/server/src/shared/net/outbound-fetch.ts`（`outboundFetch` + `resolveOutboundProxy`），读取全局 `proxy_settings`。
2. **启用语义**：`proxy_settings.enabled=false` → 与现状一致（直连）；`true` → 对目标 URL 注入 Bun `fetch` 的 `proxy`（HTTP/HTTPS）；尊重 `no_proxy`。
3. **接线范围（本阶段）**：SearXNG `webSearch`、Jina、Firecrawl、`fetchWithRedirectGuard`（含 readability / URL fetch）。
4. **明确不接线（本阶段）**：AI SDK / LLM / embedding provider 默认直连（`no_proxy` 不够表达「整类跳过」时以代码路径排除）；日后可做「单 provider 覆盖」。
5. **配置模型**：仅全局 `proxy_settings`（B1）；不做 SOCKS5（C1）；不做 per-extractor 代理覆盖（修正 r61 粒度表述）。
6. **治理**：`apps/server/AGENTS.md` 写明新出站 MUST 用 `outboundFetch`（非 LLM 路径）。

## Locked decisions

| #     | 锁定                                                       |
| ----- | ---------------------------------------------------------- |
| A     | 默认不代理 LLM/embedding；搜索/读页/URL fetch 走代理       |
| B     | 仅全局 `proxy_settings`                                    |
| C     | 仅 HTTP(S) proxy；SOCKS5 不做                              |
| Seams | resolveOutboundProxy；outboundFetch 注入；四调用点迁移单测 |

## Non-Goals

- 不代理 AI SDK provider（本阶段）。
- 不做 SOCKS5、不做 per-extractor / per-provider 覆盖（预留后续）。
- 不改 SSRF 策略本身（仍先 SSRF 再出站）。

## Capabilities

- `configuration-governance` — 出站代理 accessor / SSOT
- `source-ingestion-upload-and-url` — URL fetch / search 走代理
- `web-extractor-plugins` — 抽取器出站走代理
- `architecture-core` — 未来非 LLM 出站 MUST 用 outboundFetch

## Impact / Seams

- `shared/net/outbound-fetch.ts`、`fetch-with-redirect-guard.ts`、`extraction/{jina,firecrawl,readability}.ts`、`ai/tools/web-search.ts`、`config` accessor、`apps/server/AGENTS.md`、unit tests
