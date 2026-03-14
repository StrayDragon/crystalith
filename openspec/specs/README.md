# OpenSpec Canonical Specs (Consolidated)

本目录已按“最新主干 + 去重合并”完成收敛；旧路径 deprecated 薄壳已在 batch-2 中移除。

## Canonical Reading Order

1. 架构与基础
   - `architecture-core/spec.md`
   - `architecture-plugin-and-agent/spec.md`
   - `official-plugins/spec.md`
   - `config-and-models/spec.md`
   - `data-and-storage/spec.md`
   - `retrieval-and-cache/spec.md`
   - `background-jobs-and-task-runtime/spec.md`
2. API 与客户端
   - `workspace-api-contract/spec.md`
   - `workspace-command-registry/spec.md`
   - `openapi-and-client-generation/spec.md`
3. Workspace UI
   - `workspace-ui-core/spec.md`
   - `workspace-ui-panels/spec.md`
   - `multi-notebook-collections/spec.md`
4. Source 与生成
   - `source-ingestion-core/spec.md`
   - `source-ingestion-upload-and-url/spec.md`
   - `web-extractor-plugins/spec.md`
   - `source-ingestion-management-and-tags/spec.md`
   - `source-ingestion-summary-and-conversion/spec.md`
   - `source-connectors/spec.md`
   - `generation-core/spec.md`
   - `generation-observability-and-guardrails/spec.md`
   - `typed-generation-framework/spec.md`
   - `generation-presets-and-constraints/spec.md`
   - `structural-refinement-for-generated-results/spec.md`
   - `quality-gates-for-generation/spec.md`
   - `generation-variants-and-comparison/spec.md`
   - `source-aware-generation-modes/spec.md`
   - `cross-type-result-transformations/spec.md`
   - `knowledge-curation-and-freshness/spec.md`
   - `output-rendering-and-typing/spec.md`
5. Studio 输出
   - `studio-slides-workflow/spec.md`
   - `studio-output-types/spec.md`
   - `evidence-review-workflow/spec.md`
   - `publishable-artifacts/spec.md`
6. 交付与质量
   - `doc-governance/spec.md`
   - `docs-site/spec.md`
   - `delivery-and-deployment/spec.md`
   - `quality-and-regression/spec.md`

## Consolidation Map (Old -> New)

- `backend-module-structure`, `frontend-module-structure` -> `architecture-core`
- `agent-architecture`, `plugin-system` -> `architecture-plugin-and-agent`
- `config-management`, `ai-provider-config` -> `config-and-models`
- `data-access`, `vector-storage` -> `data-and-storage`
- `generation-retrieval`, `vector-search-cache`, `search-engine` -> `retrieval-and-cache`
- `workspace-api`, `notebook-management`, `analysis-api` -> `workspace-api-contract`
- `openapi-docs`, `frontend-api-client`, `python-sdk` -> `openapi-and-client-generation`
- `workspace-ui`, `workspace-ux-system`, `modular-canvas-layout` -> `workspace-ui-core`
- `workspace-sources-ui` -> `workspace-ui-panels`
- `workspace-chat-ui` -> `workspace-ui-panels`
- `workspace-studio-ui`, `studio-collapsible-tools` -> `workspace-ui-panels`
- `workspace-analysis-ui`, `cross-document-analysis` -> `workspace-ui-panels`
- `research-ui`, `citation-interaction` -> `workspace-ui-panels`
- `source-ingestion` -> `source-ingestion-core`
- `source-ingestion-upload`, `source-ingestion-url` -> `source-ingestion-upload-and-url`
- `source-ingestion-management`, `source-ingestion-tags` -> `source-ingestion-management-and-tags`
- `source-ingestion-summary-qa`, `content-conversion` -> `source-ingestion-summary-and-conversion`
- `output-graph`, `generation-preference`, `rag-qa`, `refine-output`, `output-postprocessing` -> `generation-core`
- `generation-observability`, `backend-performance`, `background-task-queue` -> `generation-observability-and-guardrails`
- `output-rendering`, `output-payload-typing` -> `output-rendering-and-typing`
- `studio-slides`, `studio-slides-drafts`, `studio-slides-sse`, `studio-slides-preview` -> `studio-slides-workflow`
- `studio-briefing`, `studio-guide`, `studio-flashcard`, `studio-mindmap`, `studio-quiz`, `studio-timeline` -> `studio-output-types`
- `deployment`, `deployments-layout` -> `delivery-and-deployment`
- `ci-cd`, `api-regression-suite`, `llm-evaluation`, `test-stability` -> `quality-and-regression`

## Deprecation Policy

- 迁移日期：`2026-02-25`
- batch-2 执行日期：`2026-02-25`
- 旧路径目录已删除，仅保留本 README 的 Old -> New 映射用于检索历史名称
