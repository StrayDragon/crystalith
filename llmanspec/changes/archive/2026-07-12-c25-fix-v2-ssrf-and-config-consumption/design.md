# c25 design — SSRF 配置消费 + 上传大小可配

## 决策：最小必要集 vs 全量 config 系统

GAP-REPORT 发现 5 指出 v2 config 只解析 models 段，~15 维配置被忽略。本 change **不**做全量 config 系统（那是渐进工程），只解析**安全相关最小必要集**：

| 配置段                                 | 用途        | 为何纳入                                |
| -------------------------------------- | ----------- | --------------------------------------- |
| `source_ingestion.url_fetch.security`  | SSRF 白名单 | 安全相关，Track A 已让函数可消费 policy |
| `app.http_guardrails.upload_max_bytes` | 上传大小    | 当前硬编码，运维需要可调                |

其余配置段（cache/embedding/concurrency/context_window/proxy 等）保持 raw，按需在后续 change 补。

## 实现

```ts
// shared/config.ts
export function getSecurityPolicy(): SsrfPolicy {
  const raw = config().raw;
  const sec = raw?.source_ingestion?.url_fetch?.security;
  if (!sec) return {}; // 默认姿态（deny-private）
  return {
    allowlistOnly: sec.allowlist_only === true,
    hostAllowlist: sec.allowlist_hosts,
    domainAllowlist: sec.allowlist_domains,
    cidrAllowlist: sec.allowlist_cidrs,
  };
}

export function getUploadMaxBytes(): number {
  const raw = config().raw;
  const n = raw?.app?.http_guardrails?.upload_max_bytes;
  return typeof n === 'number' && n > 0 ? n : 50 * 1024 * 1024;
}
```

## 回退语义

- 无 `source_ingestion.url_fetch.security` 段 → 空 policy → Track A 的默认姿态（拒绝私网/元数据，其余放行）
- 无 `upload_max_bytes` → 50MB

无 BREAKING：现有 config/app.yaml 即使保留 v1 段也安全（未消费的段仍进 raw）。
