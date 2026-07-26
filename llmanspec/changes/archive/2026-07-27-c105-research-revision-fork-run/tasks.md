# Tasks: c105-research-revision-fork-run

## Propose（本阶段）

- [x] proposal + design + live specs（runtime r335 · ui r460）
- [x] attach `sdd/c105-…` + validate `--stage spec`

## Apply（后续 `llman-sdd-apply`）

### 1. Shared + API

- [x] 1.1 `ResearchForkRunBodySchema`（`schedule?: boolean`）+ 响应仍用 `ResearchRunSchema`
- [x] 1.2 router `POST …/revisions/:revId/fork-run` + 可选 `POST …/schedule`（仅 queued）
- [x] 1.3 OpenAPI 中文 summary

### 2. Kernel

- [x] 2.1 `forkRunFromRevision`：拷 graph/report/配置；searchesUsed=0；status=queued；证据 remap
- [x] 2.2 原 Run 不变；默认不 schedule；`schedule:true` 或独立 schedule 口启动
- [x] 2.3 integration：两 Run 独立 + 源不变

### 3. Lab UI

- [x] 3.1 报告页「基于此快照新开研究」→ fork → 导航 `?rid=`
- [x] 3.2 Vitest 最小覆盖

### 4. 验证

- [x] 4.1 `bun test apps/server/tests/research/` + 相关 web Vitest
- [x] 4.2 `bun typecheck` + `llman sdd validate c105-… --strict`
