# Tasks: c98-revision-restore-graph-sync

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-ui` r451 + scenarios
- [x] change artifacts validate (`--strict --no-interactive`)

## Apply（`llman-sdd-apply` · 全程 main）

### 1. Restore 后 reload

- [x] 1.1 Eden `restoreRevision` 成功 → GET 全量 Run + report view + revisions；`markLabRunNeedsReload`
- [x] 1.2 本地报告页 state 用 GET 结果更新；失败内联 `actionError`（J3=A）
- [x] 1.3 Vitest：restore 触发二次 GET；marks gate；nodes/title 反映服务端响应

### 2. 图页同步

- [x] 2.1 回图 `?rid=` → `loadRun` + `pullProgress(0)`（J2=B · J5=A）；consume gate
- [x] 2.2 Eden `restoreGraphSlice` → `loadRun`（禁止静默 no-op）
- [x] 2.3 Fixture（J4=B）：修订切换写入 sessionStorage graph，与 Eden restore→reload 同构

### 3. 验证

- [x] 3.1 `cd apps/web && bun run test:ci` + `bun typecheck`
- [x] 3.2 change validate (`--strict --no-interactive`)
