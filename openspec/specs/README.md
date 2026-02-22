# OpenSpec Canonical Specs

本目录为 Crystalith 的**主规范**（canonical specs）。每个能力点对应一个目录：`openspec/specs/<capability>/spec.md`。

## 建议阅读顺序（快速建立全局心智）

1. **后端工作流/插件与生成链路**
   - `agent-architecture/spec.md`
   - `plugin-system/spec.md`
   - `output-graph/spec.md`
   - `generation-preference/spec.md`
   - `generation-retrieval/spec.md`
   - `generation-observability/spec.md`
   - `output-postprocessing/spec.md`
   - `refine-output/spec.md`
2. **后端工程结构与基础设施**
   - `backend-module-structure/spec.md`
   - `config-management/spec.md`
   - `ai-provider-config/spec.md`
   - `data-access/spec.md`
   - `notebook-management/spec.md`
   - `background-task-queue/spec.md`
   - `backend-performance/spec.md`
3. **前端工作区与交互（NotebookLM-style）**
   - `workspace-ui/spec.md`
   - `workspace-ux-system/spec.md`
   - `frontend-module-structure/spec.md`
   - `modular-canvas-layout/spec.md`
   - `workspace-sources-ui/spec.md`
   - `workspace-chat-ui/spec.md`
   - `workspace-studio-ui/spec.md`
   - `studio-collapsible-tools/spec.md`
   - `output-rendering/spec.md`
   - `citation-interaction/spec.md`
   - `workspace-analysis-ui/spec.md`
   - `research-ui/spec.md`
4. **来源、检索与搜索**
   - `source-ingestion/spec.md`
   - `source-ingestion-upload/spec.md`
   - `source-ingestion-url/spec.md`
   - `source-ingestion-management/spec.md`
   - `source-ingestion-tags/spec.md`
   - `source-ingestion-summary-qa/spec.md`
   - `content-conversion/spec.md`
   - `search-engine/spec.md`
   - `vector-storage/spec.md`
   - `vector-search-cache/spec.md`
   - `rag-qa/spec.md`
   - `analysis-api/spec.md`
   - `cross-document-analysis/spec.md`
5. **Studio 输出类型（按需查阅）**
   - `studio-slides/spec.md`
   - `studio-slides-drafts/spec.md`
   - `studio-slides-sse/spec.md`
   - `studio-slides-preview/spec.md`
   - `studio-briefing/spec.md`
   - `studio-guide/spec.md`
   - `studio-flashcard/spec.md`
   - `studio-mindmap/spec.md`
   - `studio-quiz/spec.md`
   - `studio-timeline/spec.md`
6. **SDK / API / 部署与工程化**
   - `workspace-api/spec.md`
   - `openapi-docs/spec.md`
   - `frontend-api-client/spec.md`
   - `python-sdk/spec.md`
   - `deployment/spec.md`
   - `deployments-layout/spec.md`
   - `ci-cd/spec.md`
   - `docs-site/spec.md`
   - `llm-evaluation/spec.md`

## 规范写作约定（简版）

- **Purpose**：用 2-5 句说明该 spec 的“覆盖范围/边界/不解决什么问题”。
- **Requirements**：按 `### Requirement: ...` 组织；每条需求尽量只约束一个概念。
- **Cross-links**：避免重复描述。能被其它 spec 复用的“公共契约”，放在更基础的 spec 中，并在此引用。
- **Umbrella + focused**：当某个 spec 变长时，优先拆分为“总览 spec（入口/导航/不变量）+ 聚焦 specs（具体契约）”以提高可读性。

## 术语表

- `GLOSSARY.md`
