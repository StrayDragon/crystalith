# Tasks: c109-outbound-proxy-fetch

## Propose（本阶段）

- [x] proposal + design + seams 确认
- [ ] live specs + `change start` + validate

## Apply

### 1. Core SSOT

- [ ] 1.1 `outbound-fetch.ts`：`resolveOutboundProxy` + `outboundFetch`；typed accessor 读 `proxy_settings`
- [ ] 1.2 unit：enabled / no_proxy / scheme 选择 / disabled 直连

### 2. Migrate callers（非 LLM）

- [ ] 2.1 `fetchWithRedirectGuard` → outboundFetch
- [ ] 2.2 jina + firecrawl extractors → outboundFetch
- [ ] 2.3 `web-search.ts` SearXNG → outboundFetch
- [ ] 2.4 `apps/server/AGENTS.md`：非 LLM 出站 MUST 用 outboundFetch

### 3. Verify

- [ ] 3.1 `bun test` 相关 unit + `just check`（或 typecheck/lint）
- [ ] 3.2 `llman sdd validate c109-outbound-proxy-fetch --strict --no-check`
