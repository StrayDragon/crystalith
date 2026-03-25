# hybrid-retrieval-rerank-and-debug-explanations 规范增量

## ADDED Requirements

### Requirement: Hybrid Retrieval Modes MUST Share One Explainable Ranking Contract
系统 MUST 让 vector、lexical 与 hybrid retrieval 共享同一套可解释排序 contract，而不是各自返回不可比的排序理由。

#### Scenario: 系统在不同 retrieval mode 间切换
- **WHEN** 系统使用 vector-only、lexical-only 或 hybrid 模式执行检索
- **THEN** 最终结果 SHALL 通过统一 rerank/explain contract 表达
- **AND** 调试视图 SHALL 能说明采用了哪种模式与为何降级或融合

### Requirement: Ranking Explanations MUST Be Derived from the Same Features Used for Sorting
系统 MUST 保证展示给用户的排序解释来源于真实参与排序的特征，而不是事后拼文案。

#### Scenario: 调试面展示 top reasons
- **WHEN** 用户展开某条结果的 rerank explanation
- **THEN** top reasons 与 dropped reasons SHALL 对应真实的排序或过滤特征
- **AND** SHALL 能与 retrieval trace 互相对照
