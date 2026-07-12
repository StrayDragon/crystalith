# fix-v2-ssrf-and-config-consumption — Tasks

## 配置解析

- [x] shared/config.ts 新增 getSecurityPolicy() 解析 security 段
- [x] shared/config.ts 新增 getUploadMaxBytes() 解析 upload_max_bytes

## 接线

- [x] sources/router.ts 上传端点改用 getUploadMaxBytes
- [x] sources/router.ts from-url 端点传入 getSecurityPolicy

## 验证

- [x] bun test 新增 config 解析单测（config.test.ts:115-128）
- [x] bun typecheck
- [x] 手动验证 allowlist_only 拦截非白名单 host
