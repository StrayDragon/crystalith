# c18 design — 源去重 + URL 安全

## dedup_key 计算（移植 v1 api_ingest.py:774 + 337）

```ts
// dedup.ts
import { createHash } from 'node:crypto';

export function uploadDedupKey(rawBytes: Uint8Array): string {
  return `upload:sha256:${createHash('sha256').update(rawBytes).digest('hex')}`;
}

export function urlDedupKey(url: string): string {
  const canonical = canonicalizeUrlForDedup(url);
  return `url:sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}
```

## dedup_action 流程（移植 v1 api_ingest.py:341-371）

请求带 `dedup_action` 参数（默认 create_new）：

1. 计算 dedup_key
2. 查 `sources WHERE notebook_id=? AND dedup_key=?`
3. `prompt` → 命中返回 409 `{error_code: 'SOURCE_DEDUP_HIT', existing_source_id}`
4. `reuse` → 命中返回 200 已有 source
5. `create_new` → 不查/忽略，直接创建

v1 默认 `dedup.enabled=False`，v2 同样默认不强制（dedup_action 默认 create_new），但能力就位。

## SSRF 守卫（移植 v1 url_safety.py:128-189）

```ts
// url-safety.ts
import ipaddr from 'ipaddr.js';
import isPrivate from 'private-ip';
import { lookup } from 'node:dns/promises';

export async function validateUrlForFetch(url: string, policy?: SsrfPolicy): Promise<void> {
  const parsed = new URL(url);
  // 1. scheme must be http/https
  // 2. reject userinfo (username:password@)
  // 3. port 1-65535
  // 4. IP-literal: block 169.254.169.254 (cloud metadata), check isPrivate
  // 5. hostname: DNS resolve, each IP checked
  // 6. allowlist_hosts/allowlist_domains/allowlist_cidrs/allowlist_only
}
```

`_is_blocked_ip`: `ipaddr.parse(ip).range()` in ['loopback','private','linkLocal','unspecified'] 或精确匹配 169.254.169.254。

## URL 规范化（移植 v1 url_normalize.py:20-57）

```ts
// url-normalize.ts
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'yclid',
  'igshid',
  'ref',
  'ref_src',
];

export function canonicalizeUrlForDedup(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.hash = ''; // strip fragment
  // strip default ports
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443'))
    u.port = '';
  // remove tracking params, sort remaining
  TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
  u.searchParams.sort();
  // strip trailing / on non-root path
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString();
}
```

## 上传大小限制

router upload handler 检查 `Content-Length` 或读取字节累计，超 `upload_max_bytes`（config，默认 50MB）→ 413。

## 依赖

- `ipaddr.js` (MIT, 纯 JS, IPv4/IPv6 解析 + CIDR 包含)
- `private-ip` (MIT, isPrivate 一行判断)

两者纯 JS，`bun build --compile` 友好。

## 验证

- sources BDD：dedup 场景（重复上传 409）
- 单元测试：dedup_key 计算、SSRF 拦截（内网/元数据/localhost）、URL 规范化（utm 去除）
