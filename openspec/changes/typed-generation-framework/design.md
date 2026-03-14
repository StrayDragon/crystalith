## 背景

右侧“生成”入口已经承载了越来越多的生成类型。如果不先把“什么是生成类型”固定下来，后续的预设、约束、结构化改良、多版本比较和来源模式都会继续长成互相打架的特例集合。因此本 change 的职责是固定最小公共词汇。

## 已确定决策

### D1：生成类型是一等对象
- 生成类型不再只是 prompt 与输出的偶然组合。
- 每种生成类型都必须拥有可建模的稳定契约。

### D2：类型契约必须覆盖最小公共词汇
- 类型契约至少包含输入要求、输出结构、控制面和完成语义。
- 这套词汇由公共框架定义，而不是由下游 change 争夺定义权。

### D3：生成类型与输出类型必须分离
- 生成类型回答“这次在做什么生成工作”。
- 输出类型回答“结果最终如何被渲染和承载”。

### D4：公共框架不接收具体特例回写
- 某个具体生成类型的特例不能直接写回公共框架。
- 框架只负责稳定公共词汇与扩展位。

## 已确定的具体定义

### 生成类型 vs 输出类型边界

| 概念 | 定义 | 示例 |
|------|------|------|
| **生成类型 (GenerationType)** | 描述"这次在做什么生成工作"，决定输入要求、检索策略、证据需求和完成语义 | `research`（深度研究）, `synthesis`（综合归纳）, `creative`（发散创作）, `qa`（问答） |
| **输出类型 (OutputType)** | 描述"结果最终如何被渲染和承载"，由 OutputTypePlugin 提供 | `briefing`, `guide`, `flashcard`, `mindmap`, `quiz`, `timeline`, `slides` |
| **映射关系** | 一个生成类型可以对应多个输出类型，但不是任意组合 | `research` → briefing / timeline；`synthesis` → guide / mindmap |

### 最小公共词汇 — GenerationType 契约字段集

```yaml
GenerationType:
  id: string                  # 类型标识，如 "research", "synthesis"
  display_name: string        # 用户可见名称
  input_requirements:         # 输入要求
    min_sources: int          # 最少来源数量
    source_mode: enum         # strict_evidence | synthesis | brainstorming
    user_prompt_required: bool
  output_contract:            # 输出结构契约
    compatible_output_types: list[OutputTypeId]
    default_output_type: OutputTypeId
    structured_schema: SchemaRef | null
  control_surface:            # 可配置控制面
    available_knobs: list[KnobDefinition]
    default_preset: PresetId | null
  completion_semantics:       # 完成语义
    citation_required: bool
    quality_gates: list[QualityGateId]
    allows_refinement: bool
```

### 公共框架 vs 下游扩展边界

- **公共框架负责**：类型注册/发现、契约结构定义、请求装配/路由、结果元数据标准
- **下游 change 负责**：具体 knob 定义 (presets)、具体 refinement 动作 (structural-refinement)、具体转换路径 (cross-type)、具体来源模式定义 (source-aware)
- **判定规则**：如果某字段所有生成类型都需要且语义一致 → 公共框架；如果仅部分类型需要或语义不同 → 下游扩展位

## 接口与注册语义（框架级）

本节描述“公共框架”必须稳定的最小宿主语义，避免下游为了解决局部问题各自造轮子。

### 生成类型注册与发现

- **注册入口（概念）**：系统拥有一个 `GenerationTypeRegistry`（逻辑组件即可），负责装载与发布所有可用的 `GenerationType`。
- **注册时机**：默认在服务启动时装载内置类型；未来可扩展为插件/配置驱动，但不属于本 change 的硬承诺。
- **稳定标识**：`GenerationType.id` 是稳定主键；UI 文案使用 `display_name`，不得把显示名当作 id。
- **发现与查询**：
  - 前端/调用方可以查询“可用生成类型列表”（含 `id`、`display_name`、`input_requirements` 概览、`output_contract` 概览、是否允许 refinement 等关键信息）。
  - 调用方可以按 `id` 查询单个类型契约，用于请求装配与 UI 渲染。

### 请求装配：显式携带生成类型

生成请求必须显式携带 `generation_type_id`，由系统基于类型契约进行最小装配与校验：

- **最小请求字段（草案）**

```json
{
  "generation_type_id": "research",
  "output_type_id": "briefing",
  "user_prompt": "...",
  "controls": { "preset_id": "fast", "knobs": { "depth": "deep" } },
  "inputs": { "sources": ["..."], "scope": "..." }
}
```

- **装配规则（最小）**
  - `generation_type_id` 必填；缺失则拒绝（不可隐式从按钮/路径推断）。
  - `output_type_id` 可显式提供；否则使用 `GenerationType.output_contract.default_output_type`。
  - `controls` 与 `preset_id` 属于扩展位：公共框架只负责“把它们作为类型契约允许的控制面传入”，具体 knob 定义与校验规则由 `generation-presets-and-constraints` 提供。
  - 对 `input_requirements` 做最小校验（例如 `min_sources`、`user_prompt_required`），不在此处定义完整业务校验。

### 结果对象：回传类型与完成语义

生成结果对象必须把“做了什么生成工作”和“如何被渲染承载”说清楚，并带回完成语义相关元数据：

```json
{
  "id": "gen_...",
  "generation_type_id": "research",
  "output_type_id": "briefing",
  "status": "succeeded",
  "completion": {
    "citation_required": true,
    "citations": [{ "source_id": "...", "loc": "...", "confidence": 0.8 }],
    "quality_gates": [{ "id": "min_evidence", "passed": true }],
    "allows_refinement": true
  },
  "payload": { "output": "..." }
}
```

- `generation_type_id` 与 `output_type_id` 都是结果的一级元数据字段（便于索引、过滤、治理与演化）。
- `completion` 聚合完成语义相关的最小字段：证据/引用要求、质量门信号、是否允许 refinement 等。
- **边界提醒**：`output_type_id` 不得反向决定 `generation_type_id` 的语义；输出只负责“承载/渲染”，生成类型负责“工作语义与契约”。

## 对下游 change 的消费边界

本 change 负责稳定“扩展位”，下游只消费或填充这些扩展位，不反向改写公共词汇。

### `generation-presets-and-constraints` 如何消费

- 消费 `GenerationType.control_surface.available_knobs` 与 `default_preset`，为不同类型提供可理解、可复用的 preset/constraint 体系。
- 允许为不同类型提供不同 knob 集合，但不得修改公共字段的语义（例如不得把 `input_requirements` 重解释为“可选配置”）。
- 公共框架只要求“请求中可以携带 controls”，具体 knob 定义、约束组合和校验策略在下游完成。

### `structural-refinement-for-generated-results` 如何消费

- 消费 `completion_semantics.allows_refinement` 作为能力开关，并复用结果对象中的 `generation_type_id` / `output_type_id` 定位“改良对象是什么”。
- 若需要结构化单元边界，优先复用 `output_contract.structured_schema` 或其引用的结构定义；不得为改良动作重新发明一套“结果类型模型”。

## 禁止的反向依赖（补充清单）

- 下游 change 不得为了自身需求而重新定义 `GenerationType` 的核心字段集与语义。
- 下游 change 不得把某个具体生成类型的特例直接写回公共框架（只能使用扩展位）。
- `structural-refinement-for-generated-results` 不得把结果改良需要的结构强行写回“公共结果类型模型”。

## 右侧生成入口（UI）如何基于类型模型组织

- 右侧面板的一级入口以 `GenerationType` 为单位（用户选择“要做什么工作”）。
- 每个 `GenerationType` 下展示：
  - 输入要求概览（例如最低来源数、是否必须用户提示、来源模式摘要）
  - 输出类型选择（`compatible_output_types`，默认 `default_output_type`）
  - 控制面（knobs/preset），其结构由下游 change 补齐，但入口位置与携带方式由公共框架固定
- UI 不允许以“输出类型”代替“生成类型”作为主导航模型；输出类型是二级选择。

## 复核：公共词汇对后续能力的覆盖性

- **控制项**：通过 `control_surface` 承载 preset/knob 扩展位。
- **质量门**：通过 `completion_semantics.quality_gates` 承载质量信号扩展位（`quality-gates-for-generation` 消费）。
- **结构化改良**：通过 `completion_semantics.allows_refinement` 与 `output_contract.structured_schema` 支撑（`structural-refinement...` 消费）。
- **来源模式**：通过 `input_requirements.source_mode` 作为来源使用模式的锚点（`source-aware-generation-modes` 消费/细化）。
- **结果演化/转换**：通过结果元数据中的 `generation_type_id` / `output_type_id` 与类型契约的稳定字段集提供转换语义的共同底座（`cross-type-result-transformations` 消费）。

## 非目标

- 不在本 change 中穷举所有未来生成类型。
- 不把具体控制项或 refinement 动作写回公共框架。
- 不让下游 change 反向定义公共术语。
