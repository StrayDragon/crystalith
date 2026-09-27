---
depends_on: []
branch: sdd/c111-convert-pilot-bare-rules
base_branch: main
base_sha: 0e38b732323b7f4e37e8348ba47ab5d9e4160f8d
---

# 裸规则压降试点批次（5 capability）+ BDD runner 规则块支持

## Why

llman-sdd 0.5 迁移后全仓 461 条裸规则（无嵌套可执行场景的 `规则:` 块），review 以 35 条 `pending` 信号计量。0.5 语义要求：可程序判定的行为 MUST 落成嵌套 `场景:`，确属抽象目标/治理约束的才保留裸规则并在提案记录理由。需要一个小批次校准「合格场景长什么样、豁免理由怎么写」，再推广到全量压降。

另发现 `apps/server/tests/bdd/runner.ts` 遍历 feature.children 时跳过 `规则:` 容器（`// skip Background / Rule containers`）——若未来把 specs 接入 BDD runner（feature-as-spec），嵌套场景会被静默跳过。本批次一并消除该地雷。

## What Changes

- **bdd runner**：`runFeature` 支持下钻 `规则:` 块（嵌套场景注册执行、rule 标签并入 skip 判定、rule 级 background 先于块内场景运行）；新增 harness fixture feature（含 `规则:` 块与嵌套场景）验证执行路径。
- **specs 试点压降**（5 个最小 capability，14 条裸规则）：
  - 补嵌套场景（结构化 GWT，锚定既有测试资产或可重复的静态判定，house style 对齐 web-ui-foundation r341/r342 既有场景）：bdd-test-harness r18/r19/r20/r21、chat-ui-envelope r28/r29、web-ui-foundation r338/r339/r340、workspace-command-registry r383、slides-workflow-plugins r236/r237/r238（按逐条判定，见 design）。
  - 保留裸规则 + 理由：确属人工评审/视觉治理判断的条款（如 web-ui-foundation r343），理由记录于 design.md。
- **顺手修复**：`source-aware-generation-modes` 中 `@req:r243` 重复挂在两条规则上（历史遗留的全局 req_id 冲突，0.5 validate 未报）——第二条（不同来源模式下的生成行为差异）重新取号为 r419。
- 不改任何既有规则的 MUST/SHALL 文本（纯追加场景）；不启用 `bdd:` config 段（结构校验照常，BDD 执行责任仍在项目测试套件）。

## Capabilities

- `specs/bdd-test-harness`（r18-r21）
- `specs/chat-ui-envelope`（r28/r29）
- `specs/web-ui-foundation`（r338/r339/r340/r343）
- `specs/workspace-command-registry`（r383）
- `specs/slides-workflow-plugins`（r236/r237/r238）

## Impact

- specs：结构增强（新增嵌套场景），既有条款文本零改动 → 锁定报告会出现「规则块被修改」WARNING（报告制，预期内）。
- 代码：`apps/server/tests/bdd/runner.ts` + 新 fixture feature；BDD 套件不在 `just qa` 门禁内（quality-and-regression r_bdd_optional），回归走 `just test-bdd`。
- review `pending` 信号：试点 5 capability 目标清零（保留裸规则者计入并附理由），全量 35 → 后续批次处理。
