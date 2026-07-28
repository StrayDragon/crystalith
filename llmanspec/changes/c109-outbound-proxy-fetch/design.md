# Design: c109 outbound proxy fetch

## 1. 目标

| 做                                             | 不做                              |
| ---------------------------------------------- | --------------------------------- |
| 全局 `proxy_settings` → Bun `fetch({ proxy })` | SOCKS5                            |
| 搜索 / 读页 / URL fetch 统一 `outboundFetch`   | 本阶段代理 LLM/embedding          |
| `no_proxy` + enabled 开关                      | per-extractor / per-provider 覆盖 |
| AGENTS 约定未来非 LLM 出站                     | 静默改 SSRF 语义                  |

## 2. SSOT 形状

```text
proxy_settings (enabled / http_url / https_url / no_proxy)
        │
        ▼
resolveOutboundProxy(targetUrl) → string | undefined
        │
        ▼
outboundFetch(input, init?) → fetch(input, { ...init, proxy? })
        │
        ├── webSearch (SearXNG)
        ├── jina / firecrawl extractors
        └── fetchWithRedirectGuard (readability + from-url fetch)
```

- Proxy URL 选择：目标为 `https:` 优先 `https_url`，否则 `http_url`；二者可回退彼此（非空优先）。
- `enabled=false` 或 URL 命中 `no_proxy` → 不传 `proxy`。
- `socks5_url`：配置可保留字段，本阶段 **忽略**（文档/注释标明）。

## 3. LLM 边界

- `ai/providers.ts` **不**注入 `outboundFetch`。
- 日后独立 change：providerConfig 可选 `useProxy` / `proxy`。

## 4. Spec 调整

- MODIFIED `source-ingestion-upload-and-url` r61：全局代理，非 per-extractor。
- ADDED `configuration-governance`：outboundFetch MUST + accessor。
- ADDED `architecture-core`：非 LLM 新出站 MUST 用 outboundFetch。
- ADDED/MODIFIED `web-extractor-plugins`：抽取器网络 IO MUST 经 outboundFetch。

## 5. 测试 seams（已确认）

1. `resolveOutboundProxy`：enabled / no_proxy / http vs https
2. `outboundFetch` mock：enabled 时带 `proxy`，disabled 不带
3. 调用点：jina/firecrawl/web-search/fetchWithRedirectGuard 使用 outboundFetch（spy/import 级）

## 6. 风险

- Bun 版本需支持 `fetch` 的 `proxy` 选项（当前运行时已具备）。
- 自建 localhost SearXNG：依赖默认 `no_proxy` 含 localhost。
