# citation-locator-v2-and-review-queue 规范增量

## ADDED Requirements

### Requirement: Citation Locators MUST Support Confidence-aware Review
系统 MUST 将 citation locator 与 anchor confidence 一起输出，并允许低置信或漂移问题进入 review queue。

#### Scenario: 某条引用定位不稳
- **WHEN** 某条 citation 只能生成低置信锚点或 remap 候选
- **THEN** 系统 SHALL 返回 anchor_confidence 与原因
- **AND** SHALL 支持将该问题送入 review queue 或 backfill 流程

### Requirement: Citation Review MUST Connect to Claims, Not Just Chunks
系统 MUST 让 citation review 能关联到 claim 或输出段落，而不是只停留在 chunk 层。

#### Scenario: 用户审查某段输出的证据
- **WHEN** 用户从输出段落进入 citation review
- **THEN** 系统 SHALL 能定位到对应 claim、citation locator 与来源上下文
- **AND** SHALL 支持继续追到 source highlights 或 claim map

### Requirement: Review Queue MUST Support Batchable Fix Sweeps
系统 MUST 让 citation 问题按章节、问题类型或输出对象批量修复，而不是只能逐条处理。

#### Scenario: 用户只修某一章的引用问题
- **WHEN** 用户在 review queue 中选择某一章节或某类问题
- **THEN** 系统 SHALL 支持对该子集执行 fix sweep
- **AND** SHALL 保持未选中的问题不被隐式改写
