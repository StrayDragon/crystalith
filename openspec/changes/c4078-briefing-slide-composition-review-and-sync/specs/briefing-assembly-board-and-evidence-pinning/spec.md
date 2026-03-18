# briefing-assembly-board-and-evidence-pinning 规范增量

## ADDED Requirements

### Requirement: Briefings MUST Support a Pre-publication Assembly Surface
系统 MUST 为 briefing 提供正式发布前的 assembly surface，而不是要求用户直接在正式产物上做所有拼装。

#### Scenario: 用户整理 briefing 章节与素材
- **WHEN** 用户从 notebook、evidence、charts 或 output diff 中挑选内容构建 briefing
- **THEN** 系统 SHALL 先将这些内容放入 assembly board
- **AND** SHALL 保持 assembly board 与正式 briefing 之间的清晰边界

### Requirement: Pinned Evidence MUST Remain Traceable Through Composition
系统 MUST 让被钉选的证据在 briefing 组装过程中保持可追踪，而不是在生成后再次丢失来源。

#### Scenario: 用户将关键证据固定到某段 briefing
- **WHEN** 用户对某个段落或结构节点执行 evidence pinning
- **THEN** 系统 SHALL 保留该 pin 与对应证据来源的稳定关联
- **AND** 后续 review、sync 或 note 语义 SHALL 可复用该关联
