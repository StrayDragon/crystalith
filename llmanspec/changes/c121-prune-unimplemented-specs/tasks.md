# Tasks

- [ ] t1 落地 specs 删改：删除 `llmanspec/specs/source-aware-generation-modes/` 与 `llmanspec/specs/cross-type-result-transformations/` 两 capability 目录；将 r45 规则块迁移至 `workspace-api-contract.feature`（置于 r365/r366 convert 合约群旁）并补嵌套场景 `convert-to-output-attaches-citation-chunk-ids`。验证：`llman-sdd validate --all --strict` 33/33 通过；`review` pending 108 → 94。
- [ ] t2 [blocked-by: t1] 补 r45 测试断言：`apps/server/tests/api-contract/qa-session-contract.test.ts` 的 convert-to-output 用例补「assistant 消息 citations 含 chunkId → output 附带去重 chunkIds」断言。验证：该文件 bun test 全绿。
- [ ] t3 [blocked-by: t2] 回归门禁：`just test-bdd` 全绿 + `just qa` 全绿；确认 `review` unbound 计数与作战地图口径一致（94 可行动 + 44 豁免）。
