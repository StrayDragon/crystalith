# notebook-cross-reference-suggestions-and-link-inference 规范增量

## ADDED Requirements

### Requirement: Cross-reference Suggestions MUST Be Derived from Structural Context
系统 MUST 让 cross-reference suggestions 建立在 notebook 结构、实体和上下文之上，而不是只做表面文本匹配。

#### Scenario: 系统为某个 block 生成引用建议
- **WHEN** 某个 block、标题或结论需要潜在引用建议
- **THEN** 系统 SHALL 基于结构节点、实体或上下文关系生成候选链接
- **AND** SHALL 区分强建议与弱建议

### Requirement: Link Inference MUST Require Explicit Confirmation Before Persisting
系统 MUST 将 link inference 视为建议，而不是自动写入正文或关系图。

#### Scenario: 用户看到系统推荐的引用关系
- **WHEN** 系统识别出潜在的 notebook-to-notebook 或 block-to-block 关联
- **THEN** 系统 SHALL 先以 suggestion 形式呈现
- **AND** 在用户明确确认前 SHALL 不自动持久化为正式引用关系
