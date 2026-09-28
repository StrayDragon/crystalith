# Tasks — c120-gap-remediation-first

## t1 — 实现

- [x] t1.1 r290：ingestSource 空文件前置 400 + 零 chunk 清理 400（含 contentStorage 清理），集成测试覆盖两路且断言无来源行。
- [x] t1.2 r111/r351 规则文本对齐改写 + r29 勘误，三条款补场景（锚定既有行为/测试）。

## t2 — 门禁

- [x] t2.1 `validate --specs --strict` 35/35；pending 111 → 108；`spec next-req-id` 仍 r474。
- [x] t2.2 `just qa` 全绿（r290 修复不得破坏既有 ingest 测试）。
