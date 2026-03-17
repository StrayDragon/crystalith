# briefing-to-slide-outline-sync-and-drift-hints 规范增量

## ADDED Requirements

### Requirement: Briefing and Slide Structures MUST Maintain Traceable Mappings
系统 MUST 为 briefing 结构与 slide outline 建立可追踪映射，而不是在两个产物之间只保留模糊相似关系。

#### Scenario: briefing 被转换为 slide outline
- **WHEN** 系统根据 briefing 生成或更新 slide 纲要
- **THEN** 系统 SHALL 保留 briefing 节点与 slide section 的稳定映射
- **AND** 后续 drift 检测 SHALL 复用同一映射关系

### Requirement: Drift Hints MUST Distinguish Auto-syncable and Review-only Changes
系统 MUST 区分哪些结构变化可自动同步，哪些只能提示用户复核。

#### Scenario: briefing 或 slide 一侧发生结构变更
- **WHEN** briefing 或 slide outline 的对应节点发生变化
- **THEN** 系统 SHALL 判断该变化是否属于 auto-syncable 范围
- **AND** 对超出范围的变化 SHALL 仅生成 drift hint 而不静默改写另一侧
