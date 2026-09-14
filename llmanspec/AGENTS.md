# Crystalith Project Rules

This file is referenced by the root `AGENTS.md`. Use it to add project-specific
rules, context, or conventions that AI agents should follow.

## Change Proposal Frontmatter SSOT

`llmanspec/changes/` 下任意深度（默认扫描深度 8，可用 `llman sdd --max-scan-depth` 调整）含 `proposal.md` 的目录都是 change；叶子目录名为 change id（可用分组目录组织，如 `changes/<group>/<id>/proposal.md`）。其 `proposal.md` 的 frontmatter（YAML）是**变更元信息的唯一权威**。
正文 MUST NOT 重复声明已在 frontmatter 中声明的字段，否则 SSOT 失效。

> 下文规约锚点 `<capability> r<n>` = `llmanspec/specs/<capability>.feature` 中 `@req:r<n>` 的场景；看全文用 `llman sdd show <capability>`。

### 合法字段集（规约 sdd-workflow r124 强制）

`llman sdd validate` 对 frontmatter 做未知字段检测：只接受下表字段，其余（如 `status`、`title`、`priority`、`author`）报 **ERROR**。

| 字段                 | 必填                    | 谁写入                                                              | 说明                                                                                                                                                               |
| -------------------- | ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `depends_on`         | 是（CLI 骨架默认 `[]`） | agent                                                               | 依赖的其他 change id 列表                                                                                                                                          |
| `blocks`             | 否                      | agent                                                               | 反向依赖（阻塞哪些 change）                                                                                                                                        |
| `branch`             | 否                      | **CLI**（`change start`/`attach`）                                  | attach binding 的 feature 分支                                                                                                                                     |
| `base_sha`           | 否                      | **CLI**                                                             | attach binding 的 base SHA（`baseSha` 别名已移除，出现即 ERROR）                                                                                                   |
| `base_branch`        | 否                      | **CLI**（`change start`/`attach`，`attach --base <branch>` 可覆盖） | attach binding 的 fork 基准分支，仅用于 finalize/archive 合并目标解析（规约 sdd-workflow r111、r113）；缺键回退本地默认分支，MUST NOT 参与 diff/lock-gate 范围计算 |
| `needs_specs_change` | 否（缺省 `true`）       | agent                                                               | `false` 时跳过「绑定分支是否改动 `llmanspec/specs/`」检查（规约 sdd-workflow r1）                                                                                  |

> **生命周期阶段不是 frontmatter 字段**：它由 `determine_stage`（规约 sdd-workflow r93）实时从磁盘 artifacts 推断四档（Draft/Designed/Planned/Full），用 `llman sdd show` / `llman sdd list` 查看。`status` 字段已废弃——不要再写进 frontmatter，CLI 会拒绝。`checkpointed`/`checkpoint_sha`/`skip_specs_landing`/`rules_edit_acked`/`rules_touched`/`agent_acked` 已移除（出现即 ERROR）。锁定 `@human` 规则的改动为报告制（只出 WARNING，不阻断；规约 spec-format r135）。

### 正文写作约束

- **MUST NOT** 在正文复读 frontmatter 字段：frontmatter 已声明 `branch`/`depends_on` 等，正文就不要再贴同样信息的横幅或 `## Status` 段。
- **MUST NOT** 把 `change_id` 当作 H1 重复（目录名已是 id）。正文 H1 用人类可读标题或省略。
- 正文横幅留给**非元信息**：如「本草案不实现」「前置 change 是 X」「与 Y 案的区别」等叙事说明。
- 生命周期阶段用 `llman sdd show` / `llman sdd list` 查看推断的 stage（规约 sdd-workflow r93），**不要**在正文写 status 段，也**不要**在 frontmatter 写 `status` 字段（已被 CLI 拒绝，见规约 sdd-workflow r124）。

## SDD 生命周期（v0.0.78）

### 锁定规则（报告制，r135/S0）

- 改/删既有 `@human` 场景只出 **WARNING**，不阻断 `validate` / `change finalize` / `change diff`。
- 报告按 `@req:<id>` 指明被改规则；控制点 = git 分支对比 + `llman sdd review` / `change diff` 的报告浮现。
- 已删除：`rules_touched` / `agent_acked` frontmatter、`@agent` tag、`--yes` 锁定确认语义（零兼容，无别名）。

### finalize / archive 合并语义（r113/r142）

- **合并目标**：`--into` > 绑定 `base_branch` > 本地默认分支。
- **合并方式**：`--method` > 配置 `sdd.merge_method`，**squash 缺省**（feature diff + docs rename 收敛为目标分支单个 commit）；需保留 feature 多 commit 历史时在 `llmanspec/config.yaml` 显式设 `sdd.merge_method: ff`。

## Project Context

Project-wide tech stack, commands, conventions, testing, git rules, and doc governance: see the project body of the root `AGENTS.md` (sections below the managed block).

**v2 Implementation Progress**: run `llman sdd list` for active change status.

Spec workflow paths:

- Canonical specs: `llmanspec/specs`
- Active change workspaces: `llmanspec/changes` (archive: `llmanspec/changes/archive`)
- v2 change id：`c<NN>-<verb>-<subject>`（`llmanspec/config.yaml` 的 `change_id.pattern` / `template` 机器校验与生成；取号扫描含 `changes/archive/freezed_changes.7z.archived` 内历史编号，next-id 当前为 **111**）
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
