# OpenSpec Changes — Priority Index

按优先级排序（从高到低）：`重构` → `架构优化` → `用户体验（旧功能优化）` → `新功能`。
并按编号段分组：`1000–1999`、`2000–2999`、`3000–3999`、`4000+`。

生成时间：`2026-03-24`

本文件由 `scripts/openspec/rebuild_priority_index.py` 生成；如需调整分类，请改脚本关键词权重后重跑。

## c1000–c1999 (10)

### 重构 (9)
- `c40-db-migration-drift-gates-and-sqlite-baselines` _(was c1002)_
- `c1003-workspace-backup-migration-and-tiered-archive`
- `c1007-doc-governance-drift-checks-and-spec-code-coverage`
- `c1010-capability-negotiation-fallback-order-and-route-audit`
- `c1015-notebook-block-history-and-undo-checkpoints`
- `c1017-workspace-scenario-fixtures-and-regression-harness`
- `c1033-question-merging-splitting-and-thread-refactors`
- `c1034-reader-side-glosses-and-progressive-annotations`
- `c10-backend-feature-module-conventions-and-migration-gates` _(was c1042)_

### 架构优化 (1)
- `c1009-source-trust-signals-and-quality-hints`

## c2000–c2999 (40)

### 架构优化 (39)
- `c80-evidence-gap-and-claim-checking` _(was c2002)_
- `c2003-quality-scorecards-and-eval-center`
- `c2004-engineering-roadmap-slices-and-dependency-map`
- `c2007-agentic-research-runs`
- `c2011-cross-notebook-insight-graph`
- `c2014-review-memory-and-decision-ledger`
- `c2023-large-workspace-performance-and-capacity-management`
- `c2025-concurrency-budgets-and-backpressure-visibility`
- `c2027-unified-search-query-and-rerank`
- `c2029-data-pipelines-scheduling-and-backfills`
- `c2032-canonical-entities-glossary-and-semantic-resolution`
- `c2038-source-coverage-and-evidence-map`
- `c2039-research-plan-editor-and-execution-checklists`
- `c2056-source-language-detection-and-translation-hints`
- `c2062-context-packing-and-token-budget-explainability`
- `c2063-task-feed-compaction-and-event-timeline`
- `c2069-run-cost-time-estimates-and-interrupt-points`
- `c2074-output-renderer-unification-and-template-versioning`
- `c2078-timeline-evidence-bands-and-source-drillback`
- `c2086-schema-snapshot-catalog-and-regression-baselines`
- `c2088-workspace-branching-and-safe-exploration-lanes`
- `c2089-steering-preferences-and-durable-user-rules`
- `c2091-reading-queue-prioritization-and-guided-order`
- `c2093-quote-clipping-and-note-weaving`
- `c2097-evidence-first-generation-modes-and-unsafe-claim-brakes`
- `c2112-background-refresh-windows-and-idle-execution`
- `c2115-longform-rewrite-passes-and-structural-refinement`
- `c2124-answer-shape-presets-and-output-landing-zones`
- `c2135-research-modes-explore-verify-synthesize`
- `c2137-source-family-grouping-and-origin-lineage`
- `c2143-quiet-failure-detection-and-silent-degradation-alerts`
- `c2144-observation-runs-and-non-writing-probes`
- `c2164-ingestion-trace-and-replay-fixtures`
- `c2167-frontend-error-ux-and-recovery-actions`
- `c2171-model-endpoint-health-scoring-and-failover-routing`
- `c2215-analysis-as-artifact-and-cache`
- `c2226-modular-canvas-widget-contract-and-persistence`
- `c2236-profile-aware-resource-tuning-and-adaptive-concurrency`
- `c2237-http-response-caching-etag-and-client-cache-keys`

### 新功能 (1)
- `c2036-scenario-planning-and-decision-simulations`

## c3000–c3999 (8)

### 用户体验（旧功能优化） (8)
- `c3003-personal-agent-sidebar-and-global-hotkey`
- `c3009-workspace-empty-state-seeding-and-safe-reset`
- `c3013-keyboard-first-panel-navigation-and-multi-select`
- `c3014-workspace-notification-center-and-snooze-rules`
- `c3016-pinned-work-contexts-and-scratchpads`
- `c3018-saved-searches-smart-filters-and-follow-lists`
- `c3024-context-assembly-drop-reasons-and-recovery-actions`
- `c3027-attention-budget-plans-and-deep-work-windows`

## c4000+ (43)

### 重构 (5)
- `c30-observability-and-diagnostics-foundation` _(was c4063)_
- `c4066-vector-index-migrations-atomicity-and-journaling`
- `c4070-preset-style-draft-and-regression-loop`
- `c4082-personal-knowledge-continuity-and-threaded-research-memory`
- `c4093-typed-generation-compatibility-fallback-and-repair-loop`

### 架构优化 (19)
- `c4041-run-postmortem-summaries-and-recommendation-loops`
- `c4046-output-fact-sheets-and-one-page-abstracts`
- `c4064-config-profiles-capability-matrix-and-degraded-mode`
- `c4067-run-lifecycle-durability-and-stage-gates`
- `c90-citation-claim-review-and-traceback-loop` _(was c4071)_
- `c100-workspace-state-bootstrap-and-hydration` _(was c4072)_
- `c60-api-contract-surface-fieldsets-and-client-governance` _(was c4074)_
- `c4075-workspace-frontend-performance-and-load-shaping`
- `c20-backend-runtime-context-lifecycle-and-upstream-governance` _(was c4076)_
- `c4078-briefing-slide-composition-review-and-sync`
- `c50-retrieval-trace-lens-replay-and-ranking-governance` _(was c4079)_
- `c70-source-ingestion-provenance-dedup-and-delta-indexing` _(was c4081)_
- `c4083-ui-state-events-drift-and-repair-governance`
- `c4086-external-api-webhooks-and-sdk-release-governance`
- `c4087-workspace-discovery-metadata-and-sample-gallery`
- `c4088-plugin-catalog-health-compat-and-fallback-experience`
- `c4090-provenance-replay-repro-and-regression-triage-foundation`
- `c4091-agent-sandbox-permissions-and-compute-runtime`
- `c4092-mobile-browser-capture-and-local-first-sync`

### 用户体验（旧功能优化） (4)
- `c4069-workspace-continuity-home-and-review-loops`
- `c4077-notebook-structure-navigation-and-argument-scaffolding`
- `c4085-workspace-guidance-goals-and-readiness-substrate`
- `c4089-command-action-surface-routing-and-composition`

### 新功能 (15)
- `c4000-recipe-driven-workflows`
- `c4003-multimodal-audio-video-briefings`
- `c4010-structured-data-connectors-and-sql-workflows`
- `c4015-dlp-redaction-and-sensitive-data-guards`
- `c4017-meeting-notes-ingestion-and-action-items`
- `c4021-source-remediation-queues-and-bulk-fixes`
- `c4022-quick-capture-inbox-and-triage-flow`
- `c4026-ocr-fallback-for-scanned-pdf-and-images`
- `c4027-docs-troubleshooting-hub-and-debug-recipes`
- `c4032-ingestion-work-estimates-and-budget-preview`
- `c4034-run-template-profiles-and-resume-defaults`
- `c4038-table-chart-linked-selections-and-drillthrough`
- `c4062-source-operations-readiness-and-monitoring-lifecycle`
- `c4065-source-connectors-framework-and-official-plugins-pack`
- `c4084-artifact-packaging-versioning-interoperability-and-review-bundles`

## 需要人工复核（margin ≤ 2）(12)
这些 change 的分类边界更模糊（关键词命中分差很小），建议快速扫一眼 proposal 再确认。

### c1000–c1999 (2)
- `c1010-capability-negotiation-fallback-order-and-route-audit` (refactor, margin=1)
- `c1034-reader-side-glosses-and-progressive-annotations` (refactor, margin=1)

### c2000–c2999 (4)
- `c2027-unified-search-query-and-rerank` (architecture, margin=2)
- `c2088-workspace-branching-and-safe-exploration-lanes` (architecture, margin=2)
- `c2124-answer-shape-presets-and-output-landing-zones` (architecture, margin=1)
- `c2137-source-family-grouping-and-origin-lineage` (architecture, margin=0)

### c3000–c3999 (1)
- `c3024-context-assembly-drop-reasons-and-recovery-actions` (ux, margin=1)

### c4000+ (5)
- `c4017-meeting-notes-ingestion-and-action-items` (feature, margin=2)
- `c4021-source-remediation-queues-and-bulk-fixes` (feature, margin=1)
- `c4041-run-postmortem-summaries-and-recommendation-loops` (architecture, margin=2)
- `c4082-personal-knowledge-continuity-and-threaded-research-memory` (refactor, margin=0)
- `c4087-workspace-discovery-metadata-and-sample-gallery` (architecture, margin=1)
