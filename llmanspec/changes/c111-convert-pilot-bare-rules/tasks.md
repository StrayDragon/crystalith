# Tasks — c111-convert-pilot-bare-rules

> 前后对比类判据（pending 信号数、场景计数）均在 **change 绑定分支**上相对 merge-base 测量。

## t1 — BDD runner `规则:` 块下钻 + harness fixture

- [ ] t1.1 `apps/server/tests/bdd/runner.ts`：`runFeature` 收集顶层与 `规则:` 块内场景；rule 标签并入 skip 判定；feature 级与 rule 级 background 按序执行。
- [ ] t1.2 新增 fixture feature（`apps/server/tests/bdd/features/harness/`，含 `规则:` 块 + 嵌套场景，复用既有 common 步骤），`bun test apps/server/tests/bdd/run.test.ts` 全绿且嵌套场景被注册执行。

## t2 — specs 试点压降（5 capability，14 条裸规则）[blocked-by: t1]

- [ ] t2.1 bdd-test-harness：r18/r19/r20/r21 补嵌套场景（r18 场景描述 t1 行为）。
- [ ] t2.2 chat-ui-envelope：r28/r29 补静态扫描场景。
- [ ] t2.3 web-ui-foundation：r338/r339/r340 补场景；r343 保留裸规则（理由见 design）。
- [ ] t2.4 workspace-command-registry：r383 补 schema 容忍场景。
- [ ] t2.5 slides-workflow-plugins：r236/r237/r238 补场景。
- [ ] t2.6 验证：`llman-sdd validate --specs --strict` 全绿（锁定 WARNING 报告制，预期内）；试点 5 capability 的 review `pending` 清零（保留裸规则除外）。

## t3 — 全量门禁 [blocked-by: t1, t2]

- [ ] t3.1 `llman-sdd validate <id> --strict` 与 `llman-sdd validate --specs --strict` 全绿。
- [ ] t3.2 `just test-bdd` 全绿（28 既有 + 新 fixture 用例）。
- [ ] t3.3 `just qa` 全绿（runner.ts 改动在 server 测试隔离纪律下无跨文件依赖）。
