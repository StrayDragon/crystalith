---
depends_on: [c12-add-v2-analysis-studio-refine]
blocks: [c13-add-v2-distribution, c14-add-v2-cleanup-delivery]
batch: all
---

# c15-add-v2-bdd-tests — BDD 行为驱动测试体系

## Why

v1 有 17 个 Gherkin `.feature` 文件 + pytest-bdd，覆盖 16 个业务域的端到端行为测试（中文场景描述，`# language: zh-CN`）。v2 目前只有 3 个 unit test 文件（`config.test.ts`, `db.test.ts`, `tokenizer.test.ts`），缺乏端到端行为回归。

在 c13 打包分发、c14 清理交付之前，必须建立 v2 的 BDD 测试体系，确保全部 API 端点行为与 v1 feature 描述一致，且不会因打包/清理引入回归。

## What Changes

- **NEW** `apps/server/tests/bdd/` — BDD 测试目录（按功能域分 `features/` + `steps/`）
- **NEW** `apps/server/tests/bdd/runner.ts` — 轻量 Gherkin→bun test 解析器（~200 行，基于 `@cucumber/gherkin`）
- **NEW** `apps/server/tests/bdd/steps/common.ts` — 公共步骤（Given/When/Then 的中文实现）
- **NEW** `apps/server/tests/bdd/features/` — 17 个 `.feature` 文件（来自 v1，路径调整 `/v1`→`/v2`）
- **NEW** `apps/server/tests/bdd/steps/<domain>.ts` — 按域拆分的场景步骤
- **NEW** `@cucumber/gherkin` 依赖（仅解析，MIT 许可）

## Capabilities

- bdd-test-harness (新 spec: 中文 BDD 端到端测试体系，覆盖全 16 个功能域)

## Impact

- **BREAKING 前置依赖**: c13 + c14 必须在 c15 通过后才能开始（c15 blocks c13, c14）
- 移植 v1 的 17 个 `.feature` 文件，仅改路径前缀 `/v1`→`/v2`
- pytest-bdd → 自研轻量 runner（基于 `@cucumber/gherkin` 解析器 + `bun test` 作为 runner）
- 方案选择见 design.md
