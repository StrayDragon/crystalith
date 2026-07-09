# add-v2-source-dedup-and-safety — Tasks

## 1. dedup_key 计算 + dedup_action

- [ ] 新建 `features/sources/dedup.ts`: uploadDedupKey (sha256 raw) + urlDedupKey (sha256 canonical)
- [ ] `features/sources/router.ts`: upload/from-url 写入 dedup_key
- [ ] `features/sources/router.ts`: dedup_action 参数 (prompt→409/reuse→200/create_new)
- [ ] 验证: `bun test test/sources/dedup.test.ts`（重复上传 prompt 返回 409）

## 2. SSRF 守卫

- [ ] `bun add ipaddr.js private-ip`
- [ ] 新建 `shared/net/url-safety.ts`: validateUrlForFetch (scheme/userinfo/IP范围/DNS/allowlist)
- [ ] `features/sources/router.ts`: /from-url 经 validateUrlForFetch
- [ ] 验证: `bun test test/sources/ssrf.test.ts`（localhost/10.x/169.254.169.254 被拦截）

## 3. URL 规范化

- [ ] 新建 `shared/net/url-normalize.ts`: canonicalizeUrlForDedup (utm 去除/排序/端口/fragment)
- [ ] urlDedupKey 使用 canonicalizeUrlForDedup
- [ ] 验证: `bun test test/sources/url-normalize.test.ts`（utm_source 去除后 key 一致）

## 4. 上传大小限制

- [ ] `features/sources/router.ts`: 检查 Content-Length，超 upload_max_bytes → 413
- [ ] 验证: 超限上传返回 413

## 5. 整体验证

- [ ] `cd apps/server && bun test test/sources/`（dedup + ssrf + normalize 全绿）
- [ ] `bun oxlint apps/server/src/features/sources/ apps/server/src/shared/net/`（0 error）

## Verification

```bash
cd apps/server
bun add ipaddr.js private-ip
bun test test/sources/    # dedup 409、ssrf 拦截、url 规范化
bun oxlint apps/server/src/features/sources/ apps/server/src/shared/net/
```
