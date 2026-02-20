# generation-preference Specification

## Purpose
TBD - created by archiving change generation-preference-ui. Update Purpose after archive.
## Requirements
### Requirement: Optional generation preference parameter
系统 MUST 支持一个可选的生成倾向参数 `preference`，其值为 `quality` 或 `speed`，用于在“输出质量”与“生成速度”之间进行取舍。

#### Scenario: 不提供 preference 仍可生成
- **WHEN** 客户端请求生成但不提供 `preference`
- **THEN** 系统仍正常生成（使用既有默认行为）

#### Scenario: 非法 preference 被拒绝
- **WHEN** 客户端提供非 `quality|speed` 的 `preference`
- **THEN** 系统返回 422（或等价的参数校验错误）

### Requirement: Preference tunes output generation defaults
在 outputs 生成接口中，系统 MUST 在用户未显式提供检索参数时，根据 `preference` 应用默认调参（用于检索与重试）。

#### Scenario: quality 使用更高召回与更低阈值
- **WHEN** 客户端在 outputs 生成请求中设置 `preference = quality`
- **AND** 未显式设置 `top_k` 与 `min_score`
- **THEN** 系统使用 `top_k = 8`
- **AND** 系统使用 `min_score = 0.15`
- **AND** 系统使用 `agent_retries = 3`

#### Scenario: speed 使用更低召回与更高阈值
- **WHEN** 客户端在 outputs 生成请求中设置 `preference = speed`
- **AND** 未显式设置 `top_k` 与 `min_score`
- **THEN** 系统使用 `top_k = 4`
- **AND** 系统使用 `min_score = 0.25`
- **AND** 系统使用 `agent_retries = 1`

### Requirement: Explicit retrieval params override preference
系统 MUST 允许用户显式指定 `top_k` 与 `min_score`，且显式值 MUST 优先于 `preference` 的默认调参。

#### Scenario: 显式 top_k/min_score 不被 preference 覆盖
- **WHEN** 客户端设置 `preference = quality`
- **AND** 同时显式设置 `top_k = 6` 与 `min_score = 0.3`
- **THEN** 系统使用 `top_k = 6`
- **AND** 系统使用 `min_score = 0.3`

### Requirement: Preference tunes slides generation defaults
在 slides 生成中，系统 MUST 从 `SlideGenerationConfig.preference` 读取生成倾向，并用于 outline 与 markdown 两个阶段的检索与重试调参。

#### Scenario: slides 两阶段使用同一 preference
- **WHEN** slides draft 的 `generation_config.preference = speed`
- **AND** 用户先触发 outline，再触发 markdown
- **THEN** 两个阶段均以 `speed` 作为生成倾向
