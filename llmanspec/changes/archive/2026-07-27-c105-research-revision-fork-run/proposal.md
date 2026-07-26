---
depends_on:
  - c104-research-confirm-reexpand
branch: sdd/c105-research-revision-fork-run
base_sha: abe7329fa2970a80300ad2b8460d9d111aa32d38
checkpointed: true
checkpoint_sha: abe7329fa2970a80300ad2b8460d9d111aa32d38
---

## Why

revisions 今日支持同 Run restore。用户常需「基于某快照另开一条研究」而不污染原 Run。c78 §8.5 已 defer「按 revision fork 新 Run」——本变更落地该能力。

## What Changes

1. **命令口**：`POST …/revisions/:revId/fork-run`（名以 design 为准）→ 创建**新** ResearchRun。
2. **拷贝**：新 Run MUST 拷贝该 revision 快照的 graph + report（若有）+ topic / 预算 / `modelId`；`searchesUsed` 重置（或 design 可配置）；status=`queued`（可再 schedule）。
3. **原 Run**：MUST 只读不动（图/报告/revisions 列表保持）。
4. **UI**：报告页 revisions「基于此快照新开研究」→ 导航新产品 Lab `?rid=`。

## Locked decisions

- 拷 graph+report（+ 证据 remap）；原 Run 不变；新 Run `queued`，默认不自动 schedule
- 续跑：`schedule:true` 或 `POST …/schedule`（仅 queued）
- BDD-off；独立分支；排在 C1 之后、C3 之前

## Capabilities

- `deep-research-runtime` — revision fork 新 Run
- `deep-research-ui` — 报告页入口

## Impact

- revisions API + serialize createRun 路径
- Lab report revisions UI
- 测试：fork 后两 Run 独立；原 Run 不变

## Seams

- `apps/server/src/features/research/{report,commands,router}.ts`
- shared Zod
- `EdenLabReportPage` / revisions 控件
