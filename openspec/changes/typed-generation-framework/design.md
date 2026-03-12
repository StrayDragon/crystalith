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

## 非目标

- 不在本 change 中穷举所有未来生成类型。
- 不把具体控制项或 refinement 动作写回公共框架。
- 不让下游 change 反向定义公共术语。
