# Tasks: c107-research-web-page-evidence

## Propose（本阶段）

- [x] proposal + design + seams 确认
- [x] live specs（runtime r337–r340）+ `change start` + validate

## Apply（后续 `llman-sdd-apply`）

### 1. Schema + config

- [ ] 1.1 Evidence `content`；Run `pagesUsed`/`maxPageFetches`；fork 重置 pagesUsed
- [ ] 1.2 config：`pageRatio` / `workUnitMaxSteps` / token budgets + schema gen

### 2. fetchPage + ingest

- [ ] 2.1 `fetchPage` 工具 + ExtractorFactory；LLM 锁外 IO
- [ ] 2.2 ingest：同 URL 升级 content；token 截断；失败保留 snippet
- [ ] 2.3 node-agent：work_unit + node_chat 暴露工具；步数读配置；指令含剩余 pages

### 3. Kernel 预算

- [ ] 3.1 创建时计算 maxPageFetches；单元开始算 pageSoft
- [ ] 3.2 触顶拒读不弹 budget confirm；进度/Run 暴露 pages

### 4. 短综合

- [ ] 4.1 优先 content；上下文按 nodeSummaryTokenBudget 截断

### 5. 测试

- [ ] 5.1 unit：ingest 升级/截断；pageSoft/公式；mock extractor
- [ ] 5.2 `bun test apps/server/tests/research/` 全绿

### 6. 验证

- [ ] 6.1 typecheck + `llman sdd validate c107-… --strict`
