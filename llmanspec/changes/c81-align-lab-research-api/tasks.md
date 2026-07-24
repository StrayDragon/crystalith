# Tasks: c81-align-lab-research-api

## 1. 消化盘点

- [ ] 1.1 将 c80 `inventory.md` Gap/形变转为本 change design 决策表（fix-api / fix-spec / lab-only / defer）
- [ ] 1.2 **优先**消化：任务列表（list 摘要 / status 过滤）+ Compose/create 字段对齐
- [ ] 1.3 列出 BREAKING wire 变更（若有）写入 design

## 2. 合约与实现

- [ ] 2.1 shared research Zod + `desc()` / openapi 同步（含 list item / create 若改）
- [ ] 2.2 server research handlers 按决策表真实化/收紧
- [ ] 2.3 禁止删除 research 路由挂载；PR 对照 c79 护栏清单

## 3. 测试出门

- [ ] 3.1 `cd apps/server && bun test tests/research` 全绿（含 list/create 若改）
- [ ] 3.2 相关 shared 测试 + `bun typecheck`
- [ ] 3.3 `llman sdd validate c81-align-lab-research-api --strict --no-interactive`
