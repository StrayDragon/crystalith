## 背景

单次生成并不总能命中用户真实需要。多候选比较可以帮助用户更快靠近想要的结果，但这项能力如果默认滥用，也会带来成本、界面复杂度和选择负担。因此它更适合作为可控观察项，而不是当前主线默认行为。

## 已确定决策

### D1：variant 是可选流程，不是默认生成模式
- 系统不能把所有生成都默认升级成多版本比较。
- variant 只在值得比较的场景下开启。

### D2：variant 必须围绕同一生成意图进行比较
- 多个 variant 需要共享同一生成类型和目标上下文。
- 它们不是不同任务的杂合列表。

### D3：比较重点是帮助选择，不是放大 UI 复杂度
- 需要明确候选结果、比较视图与选定动作。
- 不在本次中扩展到复杂 merge / blend 工作台。

### D4：成本与使用边界必须显式
- 何时值得进入多 variant 流程，需要产品显式定义。
- 本 change 不追求“任何场景都多生成几个看看”。

## 已确定的具体定义

### 触发规则

- **默认**：所有生成均产出单结果
- **用户主动**：用户在生成前显式选择"生成多个候选"
- **系统建议**：当结果质量门返回"警告"时，建议用户尝试多 variant
- v1 **不**自动触发多 variant

### 成本与数量限制

- v1 最多同时生成 **3** 个 variant
- 每个 variant 产生独立的 LLM 调用成本
- UI 需要在触发前显示预估成本（如"将消耗约 3x 正常生成量"）
- Variant 与主结果共享来源检索结果（只额外消耗生成成本）

## variant 对象与比较语义（v1 最小模型）

### VariantSet（候选集合）

VariantSet 表示“同一生成意图”的一次多候选生成，会绑定同一上游生成类型与共享上下文。

```yaml
VariantSet:
  id: string
  generation_type_id: string        # 消费 typed-generation-framework
  output_type_id: string            # 该次集合统一的输出承载（不与类型语义混用）
  requested_count: int              # v1 <= 3
  shared_context_ref: string        # 指向共享检索/上下文快照
  variants: list[VariantCandidate]
  selected_variant_id: string | null
  created_at: time
```

### VariantCandidate（单个候选）

```yaml
VariantCandidate:
  id: string
  result_ref: { kind: string, id: string } # 指向生成结果对象
  comparison: ComparisonMetadata
  cost_estimate: { tokens: int | null, cost_units: float | null } | null
```

### ComparisonMetadata（比较元数据）

比较元数据需要“可理解、可对比、可解释”，v1 只要求最小集合：

```yaml
ComparisonMetadata:
  quality: { overall: string, gates: list[object] } | null   # 消费 quality-gates-for-generation
  citations: { count: int | null, coverage: float | null } | null
  length: { chars: int | null, words: int | null } | null
  structure: { schema_ok: bool | null, missing_fields: list[string] | null } | null
  notes: list[string] | null                                 # 可读的差异要点（可选）
```

## 选定关系：主结果 vs 未选候选

- 一个 VariantSet 最多只能有一个 `selected_variant_id`。
- **被选定**的候选成为后续继续工作的“主结果”（进入正常的 refinement / 审阅 / 沉淀路径）。
- **未选候选**保留为“可回看备选”，但不应在后续工作流中与主结果并列抢占入口。
- 允许用户“改选”：将 `selected_variant_id` 指向另一候选，并记录一次选定事件（用于历史追溯）。

## 接口语义（v1）

### 单请求生成多个 variant

- 请求与普通生成保持同一生成意图：同一 `generation_type_id`、同一 controls（preset/knobs）、同一输入上下文。
- 额外字段仅用于表达“需要多个候选”：

```json
{
  "generation_type_id": "research",
  "output_type_id": "briefing",
  "controls": { "preset_id": "deep", "knobs": { "output_length": "detailed" } },
  "variants": { "count": 3 }
}
```

- 响应返回 `variant_set_id` 与候选列表，每个候选包含 `result_ref` 与 `comparison`。
- 共享检索结果通过 `shared_context_ref` 绑定，确保“多候选只增加生成成本，不重复检索成本”。

### 比较视图、切换与选定动作

- UI 提供一个“候选比较视图”：
  - 顶部展示候选卡片（A/B/C），每张卡片显示质量概览、引用概览、长度等可比指标
  - 点击卡片切换主预览区内容
  - 支持“差异焦点”视图（v1 可先用 notes/结构化指标 + 轻量高亮，复杂 diff 后置）
- 选定动作：
  - 用户点击“选定此结果”
  - 系统记录选定并设置 `selected_variant_id`
  - 后续入口（refinement/审阅/沉淀）默认指向被选定候选

## 产品边界与观察位

### 仍为观察项，不是强制主线

- 默认仍是单结果；variant 仅在用户主动开启或系统建议时进入。
- 任何生成类型都不应被强制要求必须走 variant 才算“完成”。

### 如何消费上游语义（对齐 typed-generation-framework / presets / quality / refinement）

- **生成类型**：使用 `generation_type_id` 固定“同一生成意图”的边界；不以输出类型替代生成类型。
- **控制项**：复用 `generation-presets-and-constraints` 的 controls 语义，保证候选之间只在“随机性/采样”等内部因素上产生差异，而不是控制面漂移。
- **结果结构与改良**：候选结果仍是标准生成结果对象；选定后进入 `structural-refinement-for-generated-results` 的改良路径。
- **质量门**：质量门的 warn 可触发“建议启用 variant”；比较元数据优先复用质量门信号与结构化指标。

### 复杂 merge / blend 能力明确后置

- v1 不提供把多个候选“合并成一个更好结果”的复杂工作台。
- 后续如需要，引入 merge/blend 必须明确其成本、解释性与对主线工作流的影响。

### 后置项说明

- D3 中的"复杂 merge / blend 工作台"后置条件：**不确定是否需要，待用户反馈后观察**

## 非目标

- 不把 variant 设为所有生成的默认模式。
- 不在本 change 中构建复杂结果 merge 系统。
- 不让 variant 能力抢走主线生成入口定义权。
