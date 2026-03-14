## 背景

同一种生成类型在不同场景下往往需要不同的控制面：深浅、长度、受众、证据约束、表达风格等。如果这些控制只能依赖隐式提示或一次性自由输入，系统就很难把“同一种类型如何更可控”做成稳定产品能力。

## 已确定决策

### D1：预设与约束必须消费公共类型词汇
- 本 change 以 `typed-generation-framework` 的公共词汇为上游前提。
- 预设与约束不定义“什么是生成类型”，只定义“同一种类型如何更可控”。

### D2：预设是高价值起点，不是黑盒 prompt 包
- 预设需要被用户理解和选择。
- 预设不能退化成不可解释的隐藏 prompt 模板。

### D3：约束必须是显式可感知控制
- 约束用于表达长度、证据强度、结构要求等显式边界。
- 哪些属于产品显式控制、哪些保留为内部策略，需要固定下来。

### D4：v1 先覆盖高价值控制项
- 本次先固定每类生成最值得显式暴露的控制项集合。
- 不追求一次把所有可调参数都搬到 UI。

## 已确定的具体定义

### v1 控制项清单

| 控制项 | 适用类型 | 产品显式 vs 内部策略 |
|--------|---------|---------------------|
| **输出长度** (short / medium / detailed) | 全部 | 产品显式 |
| **证据严格度** (strict / balanced / relaxed) | research, synthesis | 产品显式 |
| **目标受众** (expert / general / beginner) | research, synthesis, qa | 产品显式 |
| **表达风格** (formal / conversational / academic) | synthesis, creative, qa | 产品显式 |
| **结构偏好** (flat / hierarchical / narrative) | research, synthesis | 产品显式 |
| 检索 top_k / min_score | 全部 | **内部策略**（由预设映射） |
| 模型温度 | 全部 | **内部策略** |
| Prompt 模板选择 | 全部 | **内部策略** |

**划分原则**：
- **产品显式控制**：用户能理解且有意义地选择的参数
- **内部策略**：底层技术参数，由预设间接控制

## 对象模型（最小可实现草案）

本 change 只定义“可控生成层”的对象与接口语义，生成类型本身与结果结构由 `typed-generation-framework` 负责。

### 控制项（KnobDefinition）

```yaml
KnobDefinition:
  id: string                      # 例如 "output_length" / "evidence_strictness"
  display_name: string
  kind: enum                      # enum | number | boolean
  allowed_values: list[string] | null
  default_value: any | null
  description: string | null
  visibility: enum                # primary | advanced（用于避免控制面膨胀）
```

### 预设（Preset）

预设是“可理解的起点”，必须能被用户理解与选择，不能退化成黑盒 prompt 包。

```yaml
Preset:
  id: string                      # 例如 "fast" / "deep_research_report"
  generation_type_id: string       # 绑定上游 GenerationType.id
  display_name: string
  description: string | null
  knob_values: dict               # { knob_id: value }，只包含该类型允许的 knobs
  internal_policy_id: string | null # 内部策略映射标识（例如检索 top_k/min_score 的组合）
  explain:                         # 预设解释（避免黑盒）
    highlights: list[string]       # 2-3 条人类可读要点
```

### 约束（Constraints）

约束用于限制 knob 的可选范围与组合，确保“可控”不会变成“不可预测”：

```yaml
Constraint:
  id: string
  generation_type_id: string
  scope: enum                     # type | preset（类型级或某个 preset 追加）
  rule: object                    # 可实现时再细化表达式形态（v1 允许最小实现）
  message: string                 # 违反时给用户看的提示
```

## 类型绑定与接口语义

### 预设/约束如何绑定到生成类型

- 绑定主键使用 `generation_type_id`（消费 `typed-generation-framework` 的公共词汇）。
- 每个 `GenerationType` 的 `control_surface` 定义其允许的 knobs 与默认 preset；本 change 在此基础上提供：
  - 该类型可用的 preset 列表（每个 preset 自带 explain/highlights）
  - 类型级约束（Constraint.scope=type）
  - preset 级追加约束（Constraint.scope=preset）

### 请求中如何选择预设、覆盖约束、并回传有效配置

请求最小语义（与上游 `GenerationRequest.controls` 对齐）：

- `preset_id`：可选；缺省时使用类型的 `default_preset`（若存在）。
- `knobs`：可选；用于在 preset 基础上覆盖单个控制项值。
- **优先级**：`knobs` 覆盖 > `preset.knob_values` > `KnobDefinition.default_value`。
- **校验**：
  - 只能设置该生成类型允许的 knobs
  - 覆盖与 preset 的组合必须满足约束（否则拒绝并返回 Constraint.message）

结果回传语义（用于复用与“保存为预设”）：

- 结果对象 SHOULD 回传 `effective_controls`：
  - `generation_type_id`
  - `preset_id`（最终使用的 preset，可能为默认值）
  - `knobs`（最终生效的 knob 值）
  - `internal_policy_id`（若存在）

### 右侧生成面板如何按类型组织控制项

- UI 的一级选择仍然是 `GenerationType`（不以 preset 或输出类型作为主导航）。
- 在选中某个 GenerationType 后：
  - 展示该类型可选 preset（下拉/卡片），并显示 explain/highlights
  - 展示 primary knobs 作为“快速控制项”
  - advanced knobs 放入折叠区，避免控制面膨胀
- UI 必须显式展示“本次将按哪些控制项生成”，避免用户把预设理解为黑盒。

## 用户体验与边界

### 预设如何帮助复用“上一次比较好的结果”

- 在某次生成结果页提供“保存为预设”入口：把该次 `effective_controls` 固化为用户 preset（命名 + 简述）。
- 支持“用同一预设再生成”：用户选择 preset 后无需手工重复调整 knobs。
- 预设是一种“可复用起点”，不是一次性的临时参数堆。

### 控制面膨胀治理（哪些值得显式暴露）

- 显式暴露必须满足：可解释、可选择、对结果有可感知差异。
- 低层技术参数（top_k/min_score、temperature、prompt 模板）默认不直接暴露，只通过预设的 internal_policy 间接控制。
- 通过 `visibility: primary/advanced` + 渐进披露控制复杂度；每个类型 primary knobs 建议不超过 3-5 个。

### 明确边界：不重定义生成类型或结果结构

- 本 change 不新增/重写 `GenerationType` 的核心字段集，只消费其 `generation_type_id` 与 `control_surface` 扩展位。
- 本 change 不定义结果结构或 refinement 结构单元；这些属于 `typed-generation-framework` 与 `structural-refinement-for-generated-results` 的职责范围。

### 预设命名与组织

- 预设命名采用 `{目标场景}` 风格，而非技术参数堆叠
- 示例：`快速摘要` / `深度研究报告` / `学习指南（入门）` / `学术论文风格`
- 每个预设展示 2-3 个关键控制项的值（如"长度: 详细 | 证据: 严格 | 风格: 学术"）
- v1 系统提供 3-5 个内置预设，**同时支持用户自定义预设**

### 后置项说明

- D4 中的"把所有可调参数都搬到 UI"后置条件：**待 v1 用户反馈后评估哪些新控制项值得暴露**

## 非目标

- 不反向定义生成类型框架。
- 不把所有内部策略全部暴露为前端控制项。
- 不把预设写成不可解释的黑盒模板包。
