# workspace-analysis-ui Specification

## Purpose

定义 Workspace 内“跨文档分析”的前端交互：Analysis 面板（主题/关联/矛盾摘要）与全屏知识图谱视图（Sources/Outputs/Sessions 关联可视化）。该规范不定义算法细节；analysis 结果与 API 见 `analysis-api/spec.md`。

## Related specs

- `GLOSSARY.md`
- `workspace-ui/spec.md`
- `workspace-ux-system/spec.md`（layer/z-index、modal/overlay）
- `cross-document-analysis/spec.md`
- `analysis-api/spec.md`
- `workspace-api/spec.md`（notebook resources：sources/outputs/sessions/messages）
- `citation-interaction/spec.md`

## Requirements

### Requirement: Analysis panel states
Analysis 面板 MUST 覆盖以下状态并提供明确反馈：

- 空状态：未添加来源时提示“添加来源后可分析”
- 未分析：有来源但无 analysis 时提供“开始分析”入口
- 加载中：显示 loading（spinner）并禁用重复触发
- 错误：展示错误并提供重试入口
- 已分析：展示 topics / relations / contradictions 摘要

### Requirement: Analysis panel rendering contract (bounded)
在已分析状态下，面板 MUST：

- 展示 `topics`（可展开关键词）
- 展示 `relations` 中 `relation_type="similar"` 的列表（可截断展示，避免超长列表撑爆 UI）
- 展示 `contradictions` 列表（作为警示）

### Requirement: Knowledge graph view is full-screen and refreshable
系统 MUST 提供全屏知识图谱视图：

- 以 overlay 形式覆盖 Workspace（遵循 `workspace-ux-system/spec.md` 的 layer 规则）
- 顶部提供刷新与关闭入口
- 支持在打开时触发 analysis 拉取（若尚未加载）

### Requirement: Graph nodes and edges
图谱 MUST 支持三类节点与基本边类型：

- 节点：`Sources / Outputs / Sessions`
- 边：
  - `Source ↔ Source`：语义相似（由 analysis relations 聚合得到，source-level）
  - `Output → Source`：引用关系（由 outputs 的 `chunk_ids` 聚合）
  - `Session → Source`：引用关系（由 messages.citations 聚合）
- 矛盾高亮：与 `contradictions` 相关的来源节点/边 SHOULD 以红色/动效强调

### Requirement: Graph interactions and filtering
知识图谱视图 MUST：

- 支持拖拽节点、缩放与平移画布
- 支持按类型显示/隐藏（sources/outputs/sessions）
- 点击节点后在图谱内显示详情预览（标题/类型/引用数等）
- 在预览中提供“打开详情”动作：打开对应的 Source/Output/Session 详情（允许以 dialog 叠加，不要求关闭图谱）

### Requirement: Chunk-id → source aggregation is best-effort
知识图谱的 source-level 聚合依赖 `chunk_id → source_id` 映射。

- citations 已包含 `source_id` 时，UI SHOULD 直接使用 `citation.source_id`
- 对于仅有 `chunk_id` 的场景（analysis relations、outputs.chunk_ids），若无显式映射数据，UI MAY 使用启发式映射以降低请求量
- UI MUST 在映射缺失/不完整时保持可用（例如：不渲染部分边，但不崩溃）
