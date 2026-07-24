# Tasks: c83-fix-r304-create-defaults

- [x] 1.1 Delta：modify r304 + scenario（topic-only 默认外网）
- [x] 1.2 Delta：modify r311 含 progress；更新 purpose（apply/archive 时合入）
- [x] 2.1 AsyncAPI `researchStream` 补 progress 事件
- [x] 2.2 research router 注释去掉 Desk；指向 Lab
- [x] 3.1 `cd apps/server && bun test tests/research` 仍绿（回归）
- [x] 3.2 `llman sdd validate c83-fix-r304-create-defaults --strict --no-interactive`
