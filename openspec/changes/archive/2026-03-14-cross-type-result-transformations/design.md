## 背景

真实知识工作里的结果会在不同形态之间演化，但这不意味着任意类型之间都值得支持直接转换。跨类型演化的价值在于保留已有工作资产和上下文，而不是制造一个“万物互转”的脆弱承诺。

## 已确定决策

### D1：只支持有限、明确的转换路径
- 系统只为高价值、可解释的路径提供转换。
- 不把任意类型互转写成默认能力。

### D2：转换必须保留 lineage
- 跨类型演化必须保留来源结果与转换关系。
- 新结果不是脱离上下文的孤立副本。

### D3：转换需要明确保留与丢弃边界
- 系统必须说清楚哪些结构、重点或证据会被保留。
- 也必须说清楚哪些内容会被舍弃或需要重建。

### D4：本 change 建立在稳定上游语义之上
- 需要 `typed-generation-framework`、结果结构和正式产物语义已经稳定。
- 不反向改写这些上游模型。

## 已确定的具体定义

### v1 支持的转换路径

| 源类型 | 目标类型 | 保留内容 | 需要重建 |
|--------|---------|---------|---------|
| research notes (briefing) | slides | 核心观点、证据 | 视觉结构、每页布局 |
| research notes (briefing) | guide | 知识结构、引用 | 学习路径、难度分层 |
| timeline | briefing | 事件数据、时间线索 | 叙述结构、分析归纳 |
| QA 对话记录 | briefing | 关键 Q&A、引用 | 连贯叙述 |

### v1 不支持的路径

- flashcard → briefing（信息密度差异过大）
- mindmap → slides（结构映射不自然）
- 任意 → quiz（需要重建评估逻辑）

## 转换动作、lineage 与承接方式（v1）

### 转换动作（Transformation）

跨类型演化是一种显式动作：用户从一个已有结果出发，请求生成一个“目标类型”的新结果，并保留可追溯 lineage。

```yaml
TransformationRequest:
  from_result_id: string
  to:
    generation_type_id: string | null  # 可选：若目标需要切换生成类型
    output_type_id: string
  mode: enum                            # transform | regenerate
```

- `mode=transform`：仅在 route 受支持时允许；否则必须回退为 `regenerate`。
- v1 建议默认以 `output_type_id` 作为用户可见的“目标类型”，并由系统在 route 定义中决定是否需要切换 `generation_type_id`（避免 UI 暴露过多内部复杂度）。

### lineage 记录（结果演化链）

```yaml
TransformationRecord:
  id: string
  ts: time
  from_result_id: string
  to_result_id: string
  route_id: string
  mapping_summary: string | null   # 人类可读摘要：保留/重建边界
```

承接方式（v1）：

- 转换输出是一个新的结果对象 `to_result_id`（有自己的 generation_type_id / output_type_id）。
- 原结果保持不变；二者通过 `TransformationRecord` 关联。
- 若转换发生在 artifact 上（见下文），可选择把 `to_result_id` 提升为新 artifact 或作为 artifact 新版本的来源结果（由 publishable-artifacts 决定）。

## 如何从已有结果触发跨类型演化（v1）

- 在结果页提供“转换为…”入口：
  - 只展示受支持的目标类型（消费 route 清单）
  - 对不支持的目标类型，提供“重新生成”为替代路径（不伪装成转换）
- 当用户选择目标类型后：
  - UI 展示本次转换的“保留/重建”摘要（mapping_summary）
  - 用户确认后触发 TransformationRequest

## 转换前后类型与结构映射如何表达

### route 定义（受支持路径清单）

```yaml
TransformationRoute:
  id: string
  from:
    output_type_id: string
  to:
    output_type_id: string
    generation_type_id: string | null
  preserve:
    - string        # 语义描述：保留哪些结构/证据
  rebuild:
    - string        # 语义描述：需要重建哪些部分
```

- v1 用“语义描述 + 最小结构字段”表达映射边界，不强行把映射做成通用可执行 DSL（后置）。
- 若结果有 `structured_schema`（typed-generation-framework），route 可引用其结构单元名称来描述 preserve/rebuild（例如“保留结论/证据块，重建每页布局”）。

## 产品位置与非目标（后置能力）

### 不抢主线入口

- 跨类型演化是后置能力：主线仍是按生成类型/输出类型直接生成。
- 转换入口属于“继续推进工作”的快捷路径，而不是默认生成流程的必经步骤。

### 如何消费上游语义（typed-generation-framework / refinement / artifacts）

- **类型框架**：消费结果元数据中的 `generation_type_id` / `output_type_id`；route 不反向定义生成类型或输出类型。
- **结果结构与改良**：转换保持“新结果仍是标准结果对象”；选定后仍可进入 refinement（structural-refinement）或审阅（evidence-review）。
- **artifact 语义**：转换产生的新结果可被提升为 artifact，或用于形成 artifact 的新版本；lineage 需要在 artifact 与结果两侧可追溯（publishable-artifacts 提供承载）。

### “万物互转”与复杂转换工作台后置

- v1 只支持有限、明确的 route 清单。
- 不提供“任意类型互转”承诺，也不提供复杂 merge/blend/工作台式的多步转换链路。

### 后置项说明

- D4 中"依赖上游语义稳定"后置条件：**typed-generation-framework 的公共词汇确定后即可推进，属于"确认需要但延迟"类型**
- 不支持路径的后续开放：**待 v1 转换路径验证后再评估，属于"待观察"类型**

## 非目标

- 不承诺所有类型之间都可直接转换。
- 不把跨类型转换写成主线默认动作。
- 不反向重写生成类型、结果结构或 artifact 语义。
