# OpenSpec notplan-changes 合并进度

> 说明：本文件记录 notplan-changes 中“proposal 合并”进度与映射。合并完成后，旧草稿会被删除；历史可通过 git 追溯。
>
> 注：canonical proposal 可能位于 `openspec/changes/`（活跃区），映射会指向对应 change。

当前有 `proposal.md` 的提案：`2`（合并前 `11`，减少 `9`）。

## Wave 1

- [x] `add-media-overview-apis` ← `add-audio-overview-api` / `add-video-overview-api`（overview API placeholders；后续已归并到 `c4003-multimodal-audio-video-briefings`）
- [x] `ci-cd-pipeline` ← `add-ci-pipeline` / `enhance-ci-pipeline-v2`（CI/CD pipeline consolidation；后续已归并到 `c1007-doc-governance-drift-checks-and-spec-code-coverage`）

## Wave 2

- [x] `c07-identity-and-workspace-access` ← `add-auth-system`（identity/auth + workspace access baseline）
- [x] `c08-multiplayer-review-workspace` ← `add-collaborative-workspace`（sharing + roles + realtime sync；后续已归并到 `c07-identity-and-workspace-access`）
- [x] `c2009-observability-bundle-and-traceability` ← `add-observability-stack`（logs/metrics/tracing/health baseline）
- [x] `c4000-recipe-driven-workflows` ← `workflow-templates-and-recipes`（recipes/templates consolidation）
- [x] `c4003-multimodal-audio-video-briefings` ← `add-media-overview-apis`（audio/video API placeholder → briefings）

## Wave 3

- [x] `c13-workspace-ui-foundations-i18n-and-responsive` ← `add-mobile-responsive` / `add-i18n`（mobile responsive + optional locale switching）

## Wave 4

- [x] `c3001-proactive-recommendations-and-next-best-actions` ← `add-smart-suggestions`（Chat suggested questions → next best actions）

## Wave 5

- [x] `c1007-doc-governance-drift-checks-and-spec-code-coverage` ← `ci-cd-pipeline`（CI baseline + coverage + security scans + branch protection guidance）

## Wave 6

- [x] `c07-identity-and-workspace-access` ← `c08-multiplayer-review-workspace`（identity/access + sharing/collaboration consolidation）

## 映射

- `add-audio-overview-api` → `c4003-multimodal-audio-video-briefings`
- `add-video-overview-api` → `c4003-multimodal-audio-video-briefings`
- `add-media-overview-apis` → `c4003-multimodal-audio-video-briefings`
- `add-ci-pipeline` → `ci-cd-pipeline`
- `enhance-ci-pipeline-v2` → `ci-cd-pipeline`
- `ci-cd-pipeline` → `c1007-doc-governance-drift-checks-and-spec-code-coverage`
- `add-auth-system` → `c07-identity-and-workspace-access`
- `add-collaborative-workspace` → `c08-multiplayer-review-workspace`
- `c08-multiplayer-review-workspace` → `c07-identity-and-workspace-access`
- `add-observability-stack` → `c2009-observability-bundle-and-traceability`
- `add-mobile-responsive` → `c13-workspace-ui-foundations-i18n-and-responsive`
- `add-i18n` → `c13-workspace-ui-foundations-i18n-and-responsive`
- `add-smart-suggestions` → `c3001-proactive-recommendations-and-next-best-actions`
- `workflow-templates-and-recipes` → `c4000-recipe-driven-workflows`
