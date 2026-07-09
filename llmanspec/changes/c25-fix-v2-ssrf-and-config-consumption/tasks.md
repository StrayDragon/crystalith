# fix-v2-ssrf-and-config-consumption — Tasks

## 配置解析

- [ ] shared/config.ts 新增 getSecurityPolicy() 解析 security 段
- [ ] shared/config.ts 新增 getUploadMaxBytes() 解析 upload_max_bytes

## 接线

- [ ] sources/router.ts 上传端点改用 getUploadMaxBytes
- [ ] sources/router.ts from-url 端点传入 getSecurityPolicy

## 验证

- [ ] bun test 新增 config 解析单测
- [ ] bun typecheck
- [ ] 手动验证 allowlist_only 拦截非白名单 host
