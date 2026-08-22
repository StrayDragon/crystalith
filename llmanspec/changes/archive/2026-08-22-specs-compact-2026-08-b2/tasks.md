# Tasks — specs-compact-2026-08-b2

## Batch 1 — type-a 去锚定（机械改写）

- [x] deep-research-runtime r327/r328 scenarios（writeBackNodeWork/runLoop/synthesizeAndComplete/drain/seed_graph）
- [x] deep-research-ui r425/r430/r433/r438/r451/r457
- [x] bdd-test-harness（run.test.ts/SKIP_FEATURE_DIRS/目录语义收敛）
- [x] retrieval-and-cache（EpochCache/EmbedStrategy/ragRegistry.retrieveWith/searchVectors）
- [x] configuration-governance r158 + scenarios
- [x] 其余散点（source-ingestion-core csv scenario、data-and-storage saveContent/fetchContent、
      generation-core qa-context-stats、studio-output-types/studio-slides-workflow syncSlideOutput/serializeSlide、
      openapi generateOpenApiDocument 场景面、workspace-api-contract r151）

## Batch 2 — intra-spec 合并

- [x] chat-prompt-presets：r25 并入 preset-inline-directive；r192/r223 并入 preset-stats（R6/R7）
- [x] source-ingestion-management-and-tags：r268 组三合一、r210 组二合一（R9/R10）
- [x] workspace-api-contract：notebook-scoped 四条 → 两条（R4）

## Batch 3 — 跨 spec 引用化

- [x] R11/R12/R14/R17 引用化改写
- [x] R1 fm r286/r287 去重复句
- [x] R15 workspace-ui-panels r59 改引用

## 验证

- [x] `llman sdd validate --specs --strict --no-interactive` 全绿
- [x] req_id 删除后全 specs grep 无悬挂引用
