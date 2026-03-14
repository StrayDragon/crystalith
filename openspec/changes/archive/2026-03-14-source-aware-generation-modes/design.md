## 背景

不同生成类型对来源材料的依赖方式并不一样。有的需要严格证据与 citation，有的适合综合归纳，有的更偏发散启发。如果始终用同一种来源处理方式去对待所有生成，用户就很难理解系统此刻究竟是在“证据优先”还是“表达优先”。

## 已确定决策

### D1：来源模式是按生成类型组织的产品语义
- 来源模式围绕不同生成类型的使用预期来定义。
- 它不是直接暴露内部策略名词的窗口。

### D2：来源模式必须影响检索、citation 与来源展示预期
- 模式差异不能只停留在 prompt 层。
- 不同模式需要在上下文构造、引用预期和结果展示上体现差异。

### D3：来源模式建立在稳定上游语义上
- 需要先有稳定的生成类型和来源接入对象语义。
- 本 change 不抢先重写这些上游对象模型。

### D4：v1 先固定有限模式集合
- 先明确少量高价值来源模式。
- 不追求覆盖所有潜在生成场景。

## 已确定的具体定义

### v1 来源模式集合

| 模式 | 行为描述 | 适用生成类型 | 检索策略 | Citation 要求 |
|------|---------|-------------|---------|--------------|
| **strict_evidence** | 严格依赖来源，每个论点必须有引用 | research | 高精度、高 recall | 强制 |
| **synthesis** | 综合来源但允许模型归纳 | briefing, guide | 宽松检索 | 建议但不强制 |
| **brainstorming** | 来源仅作背景参考，模型可自由发挥 | creative, qa | 可选检索 | 不要求 |

### 映射与覆盖

- 每种生成类型有一个默认来源模式，用户可覆盖
- v1 每次生成只使用一种来源模式（不支持混合）
- 如果用户对同一内容需要不同来源模式，通过 variant 或转换来实现

## 上游语义消费（typed generation + source objects）

### 如何消费 `typed-generation-framework`

- 来源模式使用上游公共词汇：`GenerationType.input_requirements.source_mode`。
- 上游负责定义“生成类型契约字段集”和“请求显式携带 generation_type_id”；本 change 只在此基础上补齐：
  - `source_mode` 的产品语义与行为差异
  - 模式对 citation 预期、来源展示与上下文构造的可解释约束

### 如何消费来源接入对象语义（source-connectors / sources）

- 本 change 不新增来源对象模型，只假设系统已有可查询的来源对象集合（sources），并且 citation 可以引用这些来源对象或其片段定位。
- 对 connector 来源：
  - `sync_check` 的存在让系统可以把“来源已更新”作为 freshness/维护与严格证据的风险信号（不在本 change 内定义治理策略，只定义模式可消费这些信息）。

## 请求、结果与元数据表达（v1）

### 请求：表达当前来源模式（默认 + 可选覆盖）

- 默认值：来自 `GenerationType.input_requirements.source_mode`
- 可选覆盖：允许在请求中显式指定 `source_mode`（v1 仍限定为单一模式）

```json
{
  "generation_type_id": "research",
  "output_type_id": "briefing",
  "source_mode": "strict_evidence",
  "inputs": { "sources": ["src_1", "src_2"] },
  "controls": { "preset_id": "deep" }
}
```

约束：

- 若请求提供 `source_mode`，系统 MUST 校验该模式是否被该生成类型允许（v1 默认允许“同一类型在三种模式中切换”，但实现可在类型契约中收紧）。

### 结果：回传模式与来源依赖摘要（可解释）

结果对象应回传：

- `source_mode`（本次实际生效的模式）
- `source_usage`（本次使用来源的摘要，用于 UI 解释）
- citation / sources 展示信息（与模式匹配）

```json
{
  "id": "res_...",
  "generation_type_id": "research",
  "output_type_id": "briefing",
  "source_mode": "strict_evidence",
  "source_usage": {
    "sources_considered": 12,
    "sources_cited": 7,
    "citations_count": 18,
    "citation_required": true
  }
}
```

## 模式如何影响检索、上下文构造与结果元数据

| 模式 | 检索与上下文 | Citation 预期 | 来源展示边界 | 结果元数据重点 |
|------|-------------|---------------|--------------|----------------|
| strict_evidence | 必须检索/选择来源；上下文以可引用片段为主，尽量减少“无来源自由发挥” | 强制（缺证据应显式承认不足） | 以 citation 为主，来源列表与引用定位清晰 | `citation_required=true`，补齐 coverage/缺口提示 |
| synthesis | 可检索但允许归纳；上下文允许跨多来源整合 | 建议但不强制（关键结论可引用） | 默认展示来源列表；citation 可选展示 | `citation_required=false`，但回传引用与来源使用摘要 |
| brainstorming | 检索可选；上下文可为空或仅做背景材料 | 不要求 | 若使用来源，仅作为“背景参考”展示，不伪装为证据链 | 明确标识“非证据模式”，避免误解为严格引用 |

## 产品如何解释当前结果的来源依赖方式

### 用户可见标签（避免暴露内部策略术语）

- 内部枚举：`strict_evidence / synthesis / brainstorming`
- 用户可见文案建议：
  - strict_evidence → **证据优先**
  - synthesis → **综合归纳**
  - brainstorming → **发散草拟**

UI 展示原则：

- 在生成前：在类型配置区展示“来源模式”及其一句话解释（并允许切换）。
- 在生成后：在结果页展示“本次来源模式”badge + `source_usage` 摘要，让用户理解为何 citation/来源展示呈现为当前样式。

### 哪些属于产品概念，哪些属于内部策略

- **产品概念（对外暴露）**：来源模式、是否强制 citation、来源使用摘要（sources_considered/sources_cited）。
- **内部策略（不对外暴露）**：top_k、rerank 细节、chunk 策略、prompt 模板名、检索缓存命中率等。

## 观察项边界（不抢主线定义权）

- 本 change 仍属于观察项：它补齐“来源依赖方式”的可解释语义，但不反向改写生成类型框架或 connector 框架。
- v1 仅固定有限模式集合与单模式执行；复杂混合模式与自动切换后置，避免提前把内部策略演进锁死。

### 后置项说明

- D4 中"覆盖所有潜在生成场景"后置条件：**待 v1 三种模式验证后再考虑扩展，属于"待观察"类型**

## 非目标

- 不把内部策略术语硬暴露成产品概念。
- 不在生成类型和来源对象边界未稳时抢先落模型。
- 不把单一来源策略强行推广到所有生成类型。
