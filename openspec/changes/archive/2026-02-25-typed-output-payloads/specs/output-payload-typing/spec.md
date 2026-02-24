# output-payload-typing Specification

## ADDED Requirements

### Requirement: Output payloads MUST be modeled as a discriminated union
前端 MUST 将 output payload 建模为以 `OutputTypeId` 为判别字段的 discriminated union，使消费方可在 `switch(type)` 下获得类型 narrowing。

#### Scenario: Narrowing works for structured output types
- **WHEN** 组件按 `output.type` 分支处理 output
- **THEN** 在每个分支内可安全访问该类型约定的字段（无需 `as any`）

### Requirement: Runtime guards MUST provide safe fallback
前端 MUST 提供 runtime guards/decoder，将 API 返回的 output 解析为 typed 结构；当 payload 不匹配预期 shape 时 MUST 回退到 unknown/raw JSON 渲染路径，而不是抛出运行时异常。

#### Scenario: Unknown payload falls back to raw rendering
- **WHEN** `output.content` 不满足该 `OutputTypeId` 的最小 shape
- **THEN** 系统走 fallback 渲染（raw JSON 或通用渲染器），并避免运行时崩溃
