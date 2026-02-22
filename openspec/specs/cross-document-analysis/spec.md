# cross-document-analysis Specification

## Purpose

定义 Notebook 内“跨来源/跨文档”的轻量分析能力：在已有 chunks/向量条目的基础上抽取来源间相似关系、主题聚类，并可选做少量矛盾检测。**本 spec 作为入口与边界说明**；具体契约拆分到聚焦 specs。

## Related specs

- `GLOSSARY.md`
- `analysis-api/spec.md`（Notebook analysis API 契约）
- `workspace-analysis-ui/spec.md`（Analysis 面板 + 知识图谱 UI）
- `workspace-ui/spec.md`（入口/布局）
- `vector-storage/spec.md`（向量条目与检索）
- `generation-retrieval/spec.md`（召回策略；analysis 复用向量检索能力）
- `citation-interaction/spec.md`（output/session → source 的引用关系）

## Model（高层心智）

- 基础数据：`Source → Chunk → VectorEntry`（见 `vector-storage/spec.md`）
- AnalysisResult：`topics / relations / contradictions`（见 `analysis-api/spec.md`）
- UI：Workspace 分析面板与知识图谱视图消费 AnalysisResult（见 `workspace-analysis-ui/spec.md`）

## Non-goals

- 不做跨 Notebook 的全局知识库（scope = 单 Notebook）
- 不做强一致的事实校验/证明；矛盾检测仅为 UI 辅助信号（best-effort）
- 不替代 `research-ui/spec.md` 的长链路研究工作流

## Requirements

### Requirement: Analysis is read-only
Analysis 过程 MUST 为只读：不创建/修改 sources、chunks 或 outputs；仅返回派生结果用于 UI 展示。

### Requirement: Chunk ids refer to backend chunk records
AnalysisResult 中所有 `chunk_id(s)` MUST 指向后端 `chunks.id`（数据库主键），并可用于后续定位/引用（例如 citations / outputs 的 `chunk_ids`）。

### Requirement: UI is best-effort and bounded
UI MUST 以“降低噪声/提升可读性”为目标消费 analysis 结果：对关系数、主题数、矛盾检测数等进行上限控制；避免在大 Notebook 下渲染不可用的超密集图。
