# publish-and-share-knowledge-packs 规范增量

## ADDED Requirements

### Requirement: Publishable Results MUST Be Packaged as First-class Knowledge Packs
系统 MUST 将多输出交付件建模为 first-class knowledge packs，而不是每次临时拼接导出文件。

#### Scenario: 用户准备整理一组已审阅输出
- **WHEN** 用户将 briefing、slides、guide 或等价输出整理为正式交付件
- **THEN** 系统 SHALL 生成稳定的 knowledge pack 对象
- **AND** pack SHALL 保留其组成输出、证据关系与摘要元数据

### Requirement: Knowledge Packs MUST Preserve Review and Provenance Context
系统 MUST 让 knowledge packs 保留已审阅状态与必要 provenance，而不是在交付时切断可信来源链。

#### Scenario: 某个 pack 被用于分享或发布
- **WHEN** pack 进入后续导出、共享或发布流程
- **THEN** 系统 SHALL 能回接对应 review 状态与来源摘要
- **AND** 调用方 SHALL 不需要重新拼装这些上下文
