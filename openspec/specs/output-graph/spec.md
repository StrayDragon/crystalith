# output-graph Specification

## Purpose

定义结构化 outputs 生成的核心工作流 `OutputGraph`：从 sources 构建检索上下文、选择 schema/prompt、生成结构化内容、执行确定性后处理与 citation 映射，并最终持久化为 Output 记录。本规范只约束 outputs 路径的稳定行为；slides 有独立生成链路但复用相同的检索策略与 preference 调参。

## Related specs

- `GLOSSARY.md`
- `agent-architecture/spec.md`
- `plugin-system/spec.md`
- `generation-preference/spec.md`
- `generation-retrieval/spec.md`
- `output-postprocessing/spec.md`
- `workspace-api/spec.md`
- `citation-interaction/spec.md`
- `output-rendering/spec.md`

## Requirements

### Requirement: OutputGraph node pipeline
系统 MUST 以 pydantic-graph 定义 OutputGraph，节点顺序为：

ResolveContext → GenerateOutput → PostprocessOutput → MapCitations → PersistOutput
OutputGraph 运行完成时 MUST 返回已持久化的 Output；`Output.chunk_ids`（若存在）MUST 对应本次检索解析得到的 `resolved_chunk_ids`。

### Requirement: ResolveContext builds context from selected sources
系统 MUST 要求请求提供非空 `source_ids`，并仅在这些 sources 范围内检索 chunks 构建 context。

`source_ids` 为空或缺失时请求 MUST 失败（400 或等价校验错误），且 MUST 不进入 LLM 生成阶段。

请求显式提供 `top_k/min_score` 时 ResolveContext MUST 使用显式值，且 `preference` 默认值 MUST NOT 覆盖显式值（见 `generation-preference/spec.md`）。

### Requirement: GenerateOutput selects schema and prompt with plugin override
GenerateOutput MUST 按以下优先级选择 schema 与 default_prompt：

1. 若存在与该 `output_type` 匹配的 OutputTypePlugin → 使用 `plugin.schema`；若 `plugin.default_prompt` 非空则覆盖默认 prompt
2. 否则 → 使用核心内置 schemas/prompts

### Requirement: Agent retries follow tuning_for_request
GenerateOutput MUST 使用 `tuning_for_request(output_type, preference).agent_retries` 作为 Agent retries，以保证 outputs/slides 的“质量/速度”语义一致（详见 `generation-preference/spec.md`）。

### Requirement: Deterministic postprocessing before citation mapping
系统 MUST 在 citation 映射前执行确定性后处理，以保证内容满足最低渲染契约，并在质量模式下支持可选 repair pass（详见 `output-postprocessing/spec.md`）。

### Requirement: Citation mapping uses 1-based indices
MapCitations MUST 将模型输出中的 `citations: [1,2,...]` 映射为完整 Citation 对象（见 `workspace-api/spec.md`），并清洗非法索引。
citations 字段为字符串/混合列表或包含越界索引时，系统 MUST 忽略无效项并继续映射（不得因解析失败崩溃）。
