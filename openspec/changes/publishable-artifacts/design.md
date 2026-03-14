## 背景

当结果开始被反复引用、继续编辑和长期保留时，Crystalith 需要一种比"一次性生成结果"更稳定的对象。正式产物的意义不是把内容尽快导出离站，而是让结果能在站内持续沉淀、被追踪、被引用并继续演化。

## 已确定决策

### D1：artifact 是站内正式产物对象
- artifact 由结果提升而来，但不等于所有结果。
- 只有值得沉淀、引用和继续推进的结果才进入 artifact 生命周期。

### D2：artifact 必须保留与来源结果的关系
- artifact 不是孤立副本。
- 它需要保留从哪个结果提升而来，以及后续如何继续演化。

### D3：生命周期优先于外部导出
- v1 优先解决站内状态、引用、继续编辑和归档。
- 离站导出保留为后续附属能力。

### D4：artifact 不吞掉普通结果语义
- 普通结果仍然存在，并作为探索过程的重要对象。
- artifact 是更正式的沉淀层，而不是替代所有输出。

## 关键对象与边界

- `artifact`: 正式产物对象。
- `promotion`: 从结果提升为 artifact 的动作。
- `lineage`: artifact 与来源结果及后续演化之间的关系。
- `lifecycle`: artifact 的状态与状态转移规则。

## 已确定的具体定义

### Artifact 生命周期状态

```
draft → reviewed → finalized → archived
  ↑        ↓
  └── needs_edit
```

| 状态 | 含义 |
|------|------|
| `draft` | 从结果提升而来，可继续编辑 |
| `reviewed` | 完成 evidence review（连接 evidence-review-workflow） |
| `finalized` | 锁定版本，不再编辑 |
| `needs_edit` | 审阅后发现需要修改，回到编辑状态 |
| `archived` | 归档，保留但不再活跃 |

### Artifact 与普通结果的边界

- 普通结果是探索过程的产物，可能有多个、可丢弃
- Artifact 是值得沉淀的正式产物，有版本、有审阅状态、可被引用
- **提升 (promotion)** 是显式用户动作，系统不自动提升
- 一个结果一旦被提升为 artifact，原结果保留但标记"已提升"

## 归档、继续编辑与引用语义（v1）

### 继续编辑（editable）边界

- `draft` / `needs_edit`：可编辑（允许内容更新并形成新的版本记录或修订记录）。
- `reviewed`：默认只读；若需要修改，必须进入 `needs_edit`（由显式动作触发）。
- `finalized`：锁定；v1 不允许直接编辑 finalized 版本。
  - “从 finalized 派生一个新草稿版本”的能力后置（避免提前引入版本树复杂度）。

### 归档（archived）语义

- `archived` 表示“退出活跃工作流”，但仍可被查看与引用。
- 归档后的 artifact：
  - 默认不出现在主列表（除非用户筛选“已归档”）
  - 不可编辑（v1 简化规则）
  - lineage 与引用关系仍保留

### 引用（reference）语义

- artifact 是站内正式产物，因此必须具备稳定引用标识：
  - `artifact_id`（稳定主键）
  - `version_id`（指向某个具体版本；v1 可选，但建议保留）
- 引用时的最小语义：
  - 默认引用“当前版本”
  - 若引用的是 `draft/needs_edit`，UI 应提示“该产物仍可变更”

## 对象模型与 lineage（v1 最小集合）

### Artifact（正式产物）

```yaml
Artifact:
  id: string
  notebook_id: string
  title: string | null
  status: enum                 # draft | reviewed | finalized | needs_edit | archived
  created_at: time
  updated_at: time
  current_version_id: string
  origin:
    kind: enum                 # generation_result
    result_id: string
  lineage:
    derived_from_artifact_id: string | null
    derived_from_result_ids: list[string] | null
```

### ArtifactVersion（版本）

```yaml
ArtifactVersion:
  id: string
  artifact_id: string
  version: int                 # 递增
  created_at: time
  created_by: string | null
  payload_ref: { kind: string, id: string }  # 指向站内内容承载（不在本 change 中重做存储）
  summary: string | null
```

lineage 原则：

- promotion 创建 artifact 时，`origin.result_id` 指向来源结果，并创建 `version=1`。
- 后续继续编辑（draft/needs_edit）形成新版本时，应保留 `derived_from_result_ids`（若编辑是由新的生成/改良产生，可追加对应 result_id）。
- v1 不引入复杂分支版本树；lineage 以“可追溯来源”和“可回到来源结果”为目标。

## 接口语义（v1）

### 核心站内能力（本 change 范围内）

- **promotion**：从结果创建 artifact（生成 `artifact_id` + `version=1`）。
- **查看/列表**：按 notebook/workspace 列出 artifacts，按状态过滤；查看 artifact 详情（含 lineage 与当前版本）。
- **状态流转**：
  - `start_review` / `mark_reviewed`（对接 evidence-review-workflow 的 reviewed 语义）
  - `finalize`（锁定版本）
  - `archive`（归档）
- **引用**：为其它对象提供引用 artifact 的稳定标识（至少 artifact_id；可选 version_id）。
- **继续编辑**：在 `draft/needs_edit` 下创建新版本，并更新 current_version。

### 明确后置的导出/发布动作（不作为 v1 主线）

- 导出为 PDF/Slides/外链分享
- 多渠道发布与外部协作审阅
- 复杂版本树、分支与发布审批流

## 工作区体验（v1）

### 入口、列表与状态展示

- workspace 提供 “Artifacts” 入口（与结果列表分离，但可互相跳转）。
- 列表行最小信息：标题（或来源结果摘要）、状态 badge、更新时间、来源结果引用。
- 支持按状态过滤：draft/needs_edit（待完善）、reviewed（可发布候选）、finalized（已定稿）、archived（已归档）。

### 从结果继续编辑 artifact 或回到来源结果

- 在结果页：
  - 未提升：显示 “提升为 artifact”
  - 已提升：显示 “打开 artifact” + “查看来源结果（本结果）”
- 在 artifact 页：
  - 显示来源结果（origin.result_id）入口
  - 显示 lineage（derived_from_result_ids）以便回看“这份产物基于哪些结果演化”
  - 在 draft/needs_edit 状态提供“继续编辑”入口（创建新版本）

### 明确边界：artifact 不吞掉普通结果的探索语义

- 普通结果仍然是探索与多候选试验的主要对象（可丢弃/可并列）。
- artifact 只承载“明确被提升的正式产物”，不自动替代结果列表与探索流。
- promotion 是显式动作：v1 不允许系统自动把任意结果提升为 artifact。

### 后置项说明

- D3 中的"离站导出"后置条件：**确认需要但延迟到站内生命周期稳定后**
- "外部发布渠道集成"后置条件：**不确定是否需要，待用户反馈后观察**

## 非目标

- 不把"导出体验优化"作为核心目标。
- 不在本 change 中做全套外部发布渠道集成。
- 不把所有生成结果强行升级为 artifact。
