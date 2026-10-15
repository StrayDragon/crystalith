# Tasks — c135 replace 旧来源

- [ ] T1 服务端 replace 动作 + 集成用例
  - query schema 增 replace；两命中块的 replace 分支（删旧→正常摄取；内容命中替换后跳过同名检查）。
  - 验证：`bun test --parallel apps/server/tests/sources/c117-upload-contract.test.ts`（replace 删旧建新、级联净、同名/内容两入口）。
  - [blocked-by: ]

- [ ] T2 前端弹窗三选项 + rstest
  - resolve 三值化；替换按钮仅 filename 命中展示为主操作。
  - 验证：`bun run --cwd apps/web test:ci` + `just qa` 全绿。
  - [blocked-by: T1]
