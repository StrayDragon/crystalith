# output-payload-typing Specification

## MODIFIED Requirements

### Requirement: Output payloads MUST be modeled as a discriminated union
前端 MUST 将 output payload 建模为以 `OutputTypeId` 为判别字段的 discriminated union，使消费方可在 `switch(type)` 下获得类型 narrowing。
前端 API 映射层（如 `ApiOutput`）也 MUST 保持相同判别语义，避免在进入业务组件前退化为无关联的宽泛对象。

#### Scenario: Narrowing works for typed output branches
- **WHEN** 组件按 `output.type` 分支处理 output
- **THEN** 在每个分支内可安全访问该类型约定字段，且无需 `as any` 进行字段读取

#### Scenario: API rows preserve type-to-content association
- **WHEN** 前端消费 outputs API 返回值并进行标准化
- **THEN** `type` 与 `content` 的静态关联在类型系统中可追踪，并可直接复用 decoder 进入 typed/fallback 路径

### Requirement: Runtime guards MUST provide safe fallback
前端 MUST 提供 runtime guards/decoder，将 API 返回的 output 解析为 typed 结构；当 payload 不匹配预期 shape 时 MUST 回退到 unknown/raw JSON 渲染路径，而不是抛出运行时异常。

#### Scenario: Unknown payload falls back to raw rendering
- **WHEN** `output.content` 不满足该 `OutputTypeId` 的最小 shape
- **THEN** 系统走 fallback 渲染（raw JSON 或通用渲染器），并避免运行时崩溃

#### Scenario: Refine panel handles typed and fallback paths consistently
- **WHEN** `RefinePanel` 渲染 outputs 历史记录
- **THEN** 已知 shape 使用 typed 分支渲染，未知 shape 使用 fallback 文本/JSON 渲染，并保持页面可交互
