# Crystalith Project Rules

This file is referenced by the root `AGENTS.md`. Use it to add project-specific
rules, context, or conventions that AI agents should follow.

## Project Context

Project-wide tech stack, commands, conventions, testing, git rules, and doc governance: see the project body of the root `AGENTS.md` (sections below the managed block).

**v2 Implementation Progress**: run `llman sdd list` for active change status.

Spec workflow paths:

- Canonical specs: `llmanspec/specs`
- Active change workspaces: `llmanspec/changes` (archive: `llmanspec/changes/archive`)
- v2 changes use `c<NN>-` prefix: c00 (foundation) → later align/cleanup changes. Lower number ≈ earlier foundation; run `llman sdd list` for truth.
- All `c<NN>` changes are batch:all — must read all design.md before implementing any.
- Do not archive a change solely because tasks.md marks ✅ — tasks.md may be incomplete.

Spec-workflow-specific notes:

- For v2, do NOT run `pnpm run api:sync` (v1 OpenAPI chain removed in v2).
- OpenAPI: shared Zod → `z.toJSONSchema` assembled in `apps/server/src/openapi.ts` (Scalar); `extendZodWithOpenApi` for `.openapi()` metadata only. NOT `@elysiajs/swagger`.
- OpenAPI 路由文案：`registerApiDoc.summary` 写中文业务说明（Scalar 标题故意用 path）；tag 说明见 `OPENAPI_TAG_DESCRIPTIONS`；详见根 `AGENTS.md`「OpenAPI / Scalar 路由文档」。
- Stable entrypoints: `bun test`, `bun typecheck`.

## Spec 书写守则（防过度约束）

spec 约束的是**可验证的稳定行为**，不是实现细节。写 requirement/scenario 时：

- **禁止**把代码路径/文件名/函数名/行号写进 MUST/SHALL 语句（如
  `apps/server/src/features/x/router.ts`、`parseSection()`、`pipeline.ts:220`）。
  结构语义（如「feature 切片」「统一入口聚合」）可以约束，具体落点由代码决定。
- **禁止**硬编码魔法数字作为 MUST 默认值（如 `topK 默认 8`、`800 字符分块`、
  `浅 20/24`）。行为语义（滑动窗口、预算映射、阈值方向）入 spec；数值默认值归
  config schema（`config/app.yaml`），spec 只写「默认值 MUST 可配置 / 来自配置」。
- **禁止**引用已删除的 v1 实现（`v1 api.py:289-304` 等）。对齐意图写
  「对齐既有语义」，不再锚定旧文件。
- **禁止**把迁移期状态叙述（「当前 xx.ts:139 违反此约束」）留在 requirement 正文；
  现状修复是一次性任务，规范只保留最终行为。
- **技术选型可以约束**（如 AI SDK、sqlite-vec、gpt-tokenizer、Eden），但工具链版本号
  （typescript ^7 等）归 package.json / quality-and-regression 门禁，不进 spec。
- 跨 capability 同一行为只在一处做 canonical requirement，其余 capability 用引用语
  （「见 xxx-capability rNN」）表达，避免改一处漏一处。
- 同一行为在迁移期形成的多版本要求（如「MUST NOT 再以 X 形式提供」的历史叙事），
  合并为当前行为的单一声明。

评审要求（llman-sdd-verify）：发现 requirement 含具体文件路径/行号/魔法数字/v1 引用时，
按 C110 规则标记为 WARNING 并建议重写为行为语义。

## Artifact Rules

- design: For generated artifacts or injected blocks, include naming/marker rules and deterministic output expectations.
- design: For repo-wide refactors, include an explicit migration + rollback boundary.
- proposal: If the change renames paths/contracts, mark them as **BREAKING** and list old -> new explicitly.
- proposal: If the change introduces/updates generated artifacts, specify the SSOT, generator entrypoint, and drift gate command.
- specs: Use ADDED/MODIFIED/REMOVED/RENAMED sections as appropriate.
- specs: For MODIFIED requirements, copy the full updated requirement block (do not do partial diffs).
- tasks: Group tasks by dependency order and include explicit verification commands.
- tasks: Include drift-check commands whenever generated artifacts are involved.
