# output-postprocessing Specification

## Purpose

定义结构化输出的确定性后处理：在 outputs 持久化前对内容做最小修复与清洗（例如空结构、citations 索引），并在质量模式下允许受控的 repair pass，以保证渲染契约与可追溯性。

## Related specs

- `GLOSSARY.md`
- `output-graph/spec.md`
- `output-rendering/spec.md`
- `citation-interaction/spec.md`
- `generation-preference/spec.md`

## Requirements
### Requirement: Deterministic postprocessing for structured outputs
系统 MUST 在 outputs 持久化前执行确定性的后处理，以保证输出满足最低渲染契约（字段存在、列表非空、文本可用）。
模型输出结构可解析但关键列表为空时，系统 MUST 修复为最小可渲染结构（保证前端可渲染）。

### Requirement: Citation index sanitization
系统 MUST 清洗输出中的 citations 索引，移除非整数、重复或越界的索引，避免引用映射异常。

### Requirement: Optional repair pass in quality mode
系统 MUST 支持在 `preference = quality` 且满足触发条件时执行一次受控的 repair pass，用于修复“可解析但不满足契约”的输出。
`preference = quality` 且后处理判定输出不满足最低契约时，系统 MUST 最多执行一次 repair。

### Requirement: Postprocessing warnings are non-breaking
系统 MAY 在输出 content 中附加可选的 `_warnings` 字段用于提示自动修复/截断等情况，但 MUST 保持对现有前端渲染的兼容。
