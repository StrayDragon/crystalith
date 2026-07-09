---
depends_on: [c18-add-v2-source-dedup-and-safety]
blocks: []
batch: all
---

# c25-fix-v2-ssrf-and-config-consumption — SSRF 配置消费 + 上传大小可配

## Why

GAP-REPORT 发现 3：v2 `validateUrlForFetch` 的 `SsrfPolicy` 白名单字段曾经是死代码（声明不读取）。Track A 已修复函数本身（host/domain/cidr allowlist + allowlistOnly 生效）。但 **配置层仍未消费**：`config/app.yaml` 的 `source_ingestion.url_fetch.security.allowlist_*` 段被 v2 config 整体忽略（config.ts 只解析 models 段），所以白名单仍无法通过配置表达——只能通过代码传参。

同时 GAP-REPORT 发现 5 指出上传大小硬编码 50MB（v1 可配）。

本 change 让 config.ts 解析安全相关最小必要集（security + 上传大小），使 SSRF 白名单与上传限制可配。

## What Changes

- **MODIFIED** `shared/config.ts`: 新增 `getSecurityPolicy()` 解析 `source_ingestion.url_fetch.security` → 返回 `SsrfPolicy`；新增 `getUploadMaxBytes()` 解析 `app.http_guardrails.upload_max_bytes`（默认 50MB）
- **MODIFIED** `features/sources/router.ts`: 上传端点改用 `getUploadMaxBytes()`（替代硬编码）
- **MODIFIED** `features/sources/router.ts` from-url 端点: `validateUrlForFetch` 传入 `getSecurityPolicy()`
- 不做全量 config 系统（其余 ~13 维配置仍 raw，按需渐进补）

## Capabilities

- source-ingestion-upload-and-url

## Impact

- 改动 config.ts（+~30 行解析）+ sources/router.ts（2 处接线）
- config/app.yaml 已有对应段（从 v1 复制），无需改 yaml
- 无 BREAKING：无配置时回退默认（deny-private + 50MB）
