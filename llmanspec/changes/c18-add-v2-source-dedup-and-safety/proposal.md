---
depends_on: [c16-fix-v2-rag-foundations]
blocks: [c21-add-v2-web-extractors, c13-add-v2-distribution, c14-add-v2-cleanup-delivery]
batch: all
---

# c18-add-v2-source-dedup-and-safety — 源去重 + URL 安全

## Why

`docs/V1-V2-DRIFT-ANALYSIS.md` P1-3 揭示：v2 的 `sources.dedup_key` 列存在但**从不计算/写入**，重复上传不拦截、无 409 路径。同时 `/from-url` 是裸 `fetch(url)` **无 SSRF 防护**（v1 有完整 `validate_url_for_fetch`），无上传大小限制。这是功能缺失 + 安全退化。

## What Changes

- **NEW** `apps/server/src/features/sources/dedup.ts` — dedup_key 计算：upload→`upload:sha256:<sha256(raw)>`，url→`url:sha256:<canonical_url>`
- **MODIFIED** `apps/server/src/features/sources/router.ts` — `dedup_action` 参数：`prompt`(409 SOURCE_DEDUP_HIT) / `reuse`(200 返回已有) / `create_new`；upload/from-url 写入 dedup_key
- **NEW** `apps/server/src/shared/net/url-safety.ts` — SSRF 守卫（移植 v1 `url_safety.py`）：scheme allowlist、reject userinfo、IP 范围检查（loopback/private/link-local/元数据 169.254.169.254）、DNS 解析校验、allowlist 策略
- **NEW** `apps/server/src/shared/net/url-normalize.ts` — URL 规范化（移植 v1 `url_normalize.py`）：去 utm_ 跟踪参数、排序 query、strip 默认端口、strip fragment
- **MODIFIED** `apps/server/src/features/sources/router.ts` — `/from-url` 经 SSRF 守卫；上传大小限制→413
- **NEW** 依赖: `ipaddr.js` (IP/CIDR 解析), `private-ip` (私网判断)

## Capabilities

- source-ingestion-upload-and-url (spec delta: dedup + SSRF 安全)

## Impact

- 重复上传返回 409（prompt 模式）或复用（reuse 模式），存储不膨胀
- `/from-url` 拦截内网/元数据/私网 URL，防 SSRF
- 上传超限返回 413
