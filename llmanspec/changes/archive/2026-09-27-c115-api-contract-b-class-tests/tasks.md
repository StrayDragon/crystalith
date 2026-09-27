# Tasks — c115-api-contract-b-class-tests

## t1 — 实现与落景

- [x] t1.1 新增集成测试覆盖 B 类规则的可判定行为（bun test 全绿、hermetic）。
- [x] t1.2 workspace-api-contract.feature 为已覆盖规则补嵌套场景（锚定新测试文件）；无法 hermetic 验证的保持裸规则并记录。

## t2 — 门禁

- [x] t2.1 `just check-req-ids` 0 碰撞；`validate --specs --strict` 35/35；`spec next-req-id` 仍 r474。
- [x] t2.2 `just qa` 全绿（新增测试文件在门禁内持续守护）。
