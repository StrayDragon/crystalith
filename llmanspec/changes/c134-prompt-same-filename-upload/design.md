# c134 设计：同名上传提示（复用内容去重确认流）

- 服务端：`dedup.ts` 增 `findVisibleSourceByFilename(notebookId, filename)`（排除派生行）；
  `handleSourceUpload` 在内容未命中后追加同名检查（同一 `getDedupEnabled()` 门控，
  `create_new` 跳过）。409 details：`{ kind: 'filename' | 'content', existingSourceId,
  existing_filename }`；`reuse` 走既有 `handleGetSource(existing)` 返回。
- 优先级：内容命中优先（更强信号）；同名命中其次。
- 前端：`useSourceUploads` 读取 `details.kind` 传入弹窗；`SourceDedupConfirmDialog`
  增一行按 kind 的说明（内容相同 → 复用不占额外存储；同名不同内容 → 复用=跳过本次上传）。
- 测试：服务端集成用例（prompt 409 kind=filename / reuse 200 既有 / create_new 201 新行 /
  门控关时直接创建）；web rstest 弹窗文案分支。既有 c117 upload-contract 去重用例不动。
