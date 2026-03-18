# briefing-reading-mode-and-side-by-side-evidence 规范增量

## ADDED Requirements

### Requirement: Briefings MUST Offer a Low-distraction Review Mode
系统 MUST 为 briefing 提供低干扰的 review mode，而不是让用户只能在编辑态里勉强审读。

#### Scenario: 用户进入 briefing 审读
- **WHEN** 用户切换到 briefing review mode
- **THEN** 系统 SHALL 提供连续阅读视图
- **AND** SHALL 支持按章节切换正文与证据的阅读强度

### Requirement: Review Mode MUST Support Side-by-side Evidence Drillback
系统 MUST 允许在审读 briefing 时并排查看对应证据，而不是读完后再重新定位来源。

#### Scenario: 用户复核某个段落的证据支撑
- **WHEN** 用户在 review mode 中查看某段 briefing
- **THEN** 系统 SHALL 支持并排展示该段落对应的摘要证据或原文证据
- **AND** SHALL 保留从审读位置回到证据与返回的稳定路径
