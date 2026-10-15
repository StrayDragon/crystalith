# c135 设计：replace 动作

- 服务端：`handleSourceUpload` 两个命中块各加 replace 分支——`deleteSourceVectors` +
  删 sources 行（chunks FK 级联 + FTS 触发器）后**落到正常摄取**；内容命中替换后跳过
  同名检查（用户已做决定）。wire：`SourceUploadNestedQuerySchema.dedupAction` 增
  `'replace'`；响应复用 `SourceIngestResultSchema`。
- 前端：`DedupConfirmRequest.resolve` 改 `(action: 'reuse' | 'create_new' | 'replace')`；
  弹窗三按钮（替换仅 filename 命中显示，为主按钮）；`useSourceUploads` 映射回
  dedupAction。
- 测试：服务端 replace 删旧建新（级联净断言）+ rstest 弹窗三按钮分支。
