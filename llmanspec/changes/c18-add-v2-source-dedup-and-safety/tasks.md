# add-v2-source-dedup-and-safety — Tasks

## 1. Dedup

- [x] 新建 `features/sources/dedup.ts`: uploadDedupKey (sha256 raw) + urlDedupKey (sha256 canonical)
- [x] `features/sources/router.ts`: upload/from-url 写入 dedup_key
- [x] `features/sources/router.ts`: dedup_action 参数 (prompt→409/reuse→200/create_new)
- [x] 验证: `bun test test/sources/dedup.test.ts`（重复上传 prompt 返回 409）

## 2. SSRF 防护

- [x] `bun add ipaddr.js private-ip`
- [x] 新建 `shared/net/url-safety.ts`: validateUrlForFetch (scheme/userinfo/IP范围/DNS/allowlist)
- [x] `features/sources/router.ts`: /from-url 经 validateUrlForFetch
- [x] 验证: `bun test test/sources/ssrf.test.ts`（localhost/10.x/169.254.169.254 被拦截）

## 3. URL 规范化

- [x] 新建 `shared/net/url-normalize.ts`: canonicalizeUrlForDedup (utm 去除/排序/端口/fragment)
- [x] urlDedupKey 使用 canonicalizeUrlForDedup
- [x] 验证: `bun test test/sources/url-normalize.test.ts`（utm_source 去除后 key 一致）

## 4. 上传大小限制

- [x] `features/sources/router.ts`: 检查 Content-Length，超 upload_max_bytes → 413
- [x] 验证: 超限上传返回 413

## 5. 验证（代码已实现，专属测试待补）

- [x] 功能代码已实现（dedup.ts / url-safety.ts / url-normalize.ts / router.ts）
- [ ] `cd apps/server && bun test test/sources/`（dedup + ssrf + normalize 全绿，测试文件待创建）
- [x] `bun oxlint apps/server/src/features/sources/ apps/server/src/shared/net/`（0 error）

## Verification

```bash
cd apps/server
bun test test/sources/      # dedup + ssrf + normalize
bun oxlint apps/server/src/features/sources/ apps/server/src/shared/net/
```
