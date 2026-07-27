# Tasks: c104-research-confirm-reexpand

## Propose（本阶段）

- [x] proposal + design + live specs（runtime r333–r334 · ui r459）
- [x] attach `sdd/c104-…` + validate `--stage spec`

## Apply（后续 `llman-sdd-apply`）

### 1. Shared + API

- [x] 1.1 `confirmKind` + `reexpand`；confirm actions `approve_reexpand`/`skip_reexpand`
- [x] 1.2 `ResearchRequestReexpandBodySchema` + router POST `…/request-reexpand`
- [x] 1.3 OpenAPI 中文 summary

### 2. Kernel

- [x] 2.1 `requestReexpand` → awaiting_confirm
- [x] 2.2 approve → planner 再拆 + graph_patch + drain；skip 收束
- [x] 2.3 无自动二次 decompose 回归

### 3. Lab UI

- [x] 3.1 再扩展入口 + reexpand 确认条
- [x] 3.2 Vitest 最小覆盖

### 4. 验证

- [x] 4.1 `bun test apps/server/tests/research/` + 相关 web Vitest
- [x] 4.2 `bun typecheck` + `llman sdd validate c104-… --strict`
