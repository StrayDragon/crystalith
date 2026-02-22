# generation-preference Specification

## Purpose

定义生成“偏好”（`preference`）的端到端语义：在质量与速度之间提供稳定的调参入口，并以**表驱动**的方式集中管理默认调参，避免散落的 heuristic。规范重点是**语义与优先级**（显式参数覆盖），具体默认值以实现中的 tuning table 为准。

## Related specs

- `GLOSSARY.md`
- `output-graph/spec.md`
- `generation-retrieval/spec.md`
- `studio-slides/spec.md`
- `workspace-api/spec.md`

## Requirements

### Requirement: Optional generation preference parameter
系统 MUST 支持一个可选的生成倾向参数 `preference`，其值为 `quality` 或 `speed`，用于在“输出质量”与“生成速度”之间进行取舍。

`preference` 为空时系统 MUST 仍可生成（使用默认行为）；非 `quality|speed` 的值 MUST 返回 422（或等价的参数校验错误）。

### Requirement: Table-driven tuning model
系统 MUST 使用一个集中式 tuning 表将 `(OutputType, preference)` 映射为一组默认调参（`GenerationTuning`），其字段至少包含：

- `top_k` / `min_score`（检索召回与阈值）
- `agent_retries`（结构化生成重试次数）
- `multi_query` / `multi_query_seed_cap`（multi-query 检索开关与种子上限）
- `max_chunks_per_source`（来源多样性上限）
- `token_budget_ratio`（context budget 占 context window 的比例）
系统从 tuning 表返回 MUST 是完整 knob 集合（而非仅 top_k/min_score）。

### Requirement: Preference tunes outputs defaults (when not explicit)
在 outputs 生成接口中，系统 MUST 在用户**未显式提供**检索参数时，根据 `preference` 应用默认调参（用于检索与重试）。

`quality` 的默认调参 SHOULD 比 `speed` 更“保守且更充分”（例如 `top_k` 与 `agent_retries` 不小于 speed）。

### Requirement: Explicit retrieval params override preference
系统 MUST 允许用户显式指定 `top_k` 与 `min_score`，且显式值 MUST 优先于 `preference` 的默认调参。

### Requirement: Default tuning values are centralized
系统 SHOULD 将默认值集中在 tuning 表中，并在 logs 中记录 effective tuning，以便回归调参。

实现 SHOULD 提供基础 tuning（default/quality/speed）与按 `OutputType` 的覆盖，并保持“可覆盖/可观测”特性；multi-query 可能被环境开关强制开启（即使 tuning 中为 false），但仍 MUST 遵循 `seed_cap` 等护栏（见 `generation-retrieval/spec.md`）。

### Requirement: Preference is persisted in slides generation_config
在 slides 生成中，系统 MUST 从 `SlideGenerationConfig.preference` 读取生成倾向，并用于 outline 与 markdown 两个阶段的检索与重试调参。
