# Tasks — c134 同名上传提示

- [x] T1 服务端同名软去重 + 集成用例
  - dedup.ts 增文件名查找（仅可见行）；handleSourceUpload 追加同名检查（同门控；409 带 kind/existing_filename；reuse 返回既有；create_new 照常）。
  - 验证：`bun test --parallel apps/server/tests/sources/`（新增 prompt/reuse/create_new/门控关四态）。
  - [blocked-by: ]

- [x] T2 前端弹窗 kind 文案 + rstest
  - useSourceUploads 透传 kind；SourceDedupConfirmDialog 按 kind 显示说明行。
  - 验证：`bun run --cwd apps/web test:ci` + `just qa` 全绿。
  - [blocked-by: T1]
