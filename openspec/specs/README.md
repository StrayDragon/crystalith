# OpenSpec Canonical Specs (Consolidated)

本目录已按“最新主干 + 去重合并”完成收敛。当前 canonical 规范为统一命名的 24 个 spec；旧路径 deprecated 薄壳已在 batch-2 中移除。

## Canonical Reading Order

1. 架构与基础
   - `architecture-core/spec.md`
   - `architecture-plugin-and-agent/spec.md`
   - `config-and-models/spec.md`
   - `data-and-storage/spec.md`
   - `retrieval-and-cache/spec.md`
2. API 与客户端
   - `workspace-api-contract/spec.md`
   - `openapi-and-client-generation/spec.md`
3. Workspace UI
   - `workspace-ui-core/spec.md`
   - `workspace-ui-sources/spec.md`
   - `workspace-ui-chat/spec.md`
   - `workspace-ui-studio/spec.md`
   - `workspace-ui-analysis/spec.md`
   - `workspace-ui-research-and-citation/spec.md`
4. Source 与生成
   - `source-ingestion-core/spec.md`
   - `source-ingestion-upload-and-url/spec.md`
   - `source-ingestion-management-and-tags/spec.md`
   - `source-ingestion-summary-and-conversion/spec.md`
   - `generation-core/spec.md`
   - `generation-observability-and-guardrails/spec.md`
   - `output-rendering-and-typing/spec.md`
5. Studio 输出
   - `studio-slides-workflow/spec.md`
   - `studio-output-types/spec.md`
6. 交付与质量
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
- `workspace-sources-ui` -> `workspace-ui-sources`
- `workspace-chat-ui` -> `workspace-ui-chat`
- `workspace-studio-ui`, `studio-collapsible-tools` -> `workspace-ui-studio`
- `workspace-analysis-ui`, `cross-document-analysis` -> `workspace-ui-analysis`
- `research-ui`, `citation-interaction` -> `workspace-ui-research-and-citation`
- `source-ingestion` -> `source-ingestion-core`
- `source-ingestion-upload`, `source-ingestion-url` -> `source-ingestion-upload-and-url`
- `source-ingestion-management`, `source-ingestion-tags` -> `source-ingestion-management-and-tags`
- `source-ingestion-summary-qa`, `content-conversion` -> `source-ingestion-summary-and-conversion`
- `output-graph`, `generation-preference`, `rag-qa`, `refine-output`, `output-postprocessing` -> `generation-core`
- `generation-observability`, `backend-performance`, `background-task-queue` -> `generation-observability-and-guardrails`
- `output-rendering`, `output-payload-typing` -> `output-rendering-and-typing`
- `studio-slides`, `studio-slides-drafts`, `studio-slides-sse`, `studio-slides-preview` -> `studio-slides-workflow`
- `studio-briefing`, `studio-guide`, `studio-flashcard`, `studio-mindmap`, `studio-quiz`, `studio-timeline` -> `studio-output-types`
- `deployment`, `deployments-layout`, `docs-site` -> `delivery-and-deployment`
- `ci-cd`, `api-regression-suite`, `llm-evaluation`, `test-stability` -> `quality-and-regression`

## Deprecation Policy

- 迁移日期：`2026-02-25`
- batch-2 执行日期：`2026-02-25`
- 旧路径目录已删除，仅保留本 README 的 Old -> New 映射用于检索历史名称
