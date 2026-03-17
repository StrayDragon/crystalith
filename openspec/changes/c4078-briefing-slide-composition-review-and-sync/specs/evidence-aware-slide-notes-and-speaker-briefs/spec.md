# evidence-aware-slide-notes-and-speaker-briefs 规范增量

## ADDED Requirements

### Requirement: Slide Notes MUST Stay Grounded in Evidence and Structure
系统 MUST 让 slide notes 建立在对应 slide 结构与证据之上，而不是成为脱离来源的自由备注层。

#### Scenario: 用户查看某页 slide 的讲述备注
- **WHEN** 某页 slide 存在配套 notes 或 speaker brief
- **THEN** 该说明 SHALL 能回接对应 slide section、briefing 映射和核心证据
- **AND** 用户 SHALL 能理解“这一页为什么这么讲”

### Requirement: Speaker Briefs MUST Preserve Drift and Appendix Context
系统 MUST 让 speaker briefs 在提供讲述摘要时保留 drift 状态与必要的附录/脚注上下文。

#### Scenario: slide 纲要已发生漂移但用户仍需讲述
- **WHEN** 用户打开某页的 speaker brief
- **THEN** 系统 SHALL 暴露该页是否存在未处理 drift
- **AND** SHALL 允许用户回接相关 appendix、footnotes 或 briefing review 线索
