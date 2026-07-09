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

## DRIFT 显式 out-of-scope（已接受，不实现）

以下 DRIFT 报告项明确**不在 v2 范围**，原因记录于此（避免遗留疑问）：

- **音频/视频/YouTube/转录**：调研确认 v1 的 `MediaFetcher` 是 stub（`DisabledMediaFetcher`，always raises），YouTube 下载/视频音轨提取**v1 本身也未实现**。v2 同样不实现，文档标注 unsupported。
- **CSV/markdown 预处理**：v2 textParser 走 UTF-8 直传，不做 markdown 预处理。低频场景，接受现状。
- **错误码粒度**（v1 8 种 typed error_code vs v2 1 种 PARSE_ERROR）：c18 保持简化错误码，c19 任务失败时补充 task.error 文本。不追求 8 种枚举对齐。
- **AI 可观测性**（usage/cost/latency 采集）：v2 仅 retry 中间件。完整可观测性（trace/usage 持久化）留待 c13 (分发) 的 observability 层或独立 change，不在行为对齐范围。
