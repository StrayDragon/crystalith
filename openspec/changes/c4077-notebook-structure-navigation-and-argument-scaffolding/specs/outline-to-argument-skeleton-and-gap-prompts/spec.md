# outline-to-argument-skeleton-and-gap-prompts 规范增量

## ADDED Requirements

### Requirement: Notebook Structure MUST Be Liftable into an Argument Skeleton
系统 MUST 允许 outline 与结构节点提升为 argument skeleton，而不是要求用户每次从零组织论证框架。

#### Scenario: 用户从大纲进入论证整理阶段
- **WHEN** 用户选择基于 notebook 结构生成 argument skeleton
- **THEN** 系统 SHALL 将结构节点映射为 claim、support、counterpoint、evidence gap 或等价角色
- **AND** SHALL 保留与原 notebook 结构节点的可追踪关系

### Requirement: Gap Prompts MUST Surface Missing Support at the Structure Layer
系统 MUST 在 skeleton 层直接暴露缺口，而不是等到全文生成后才发现论证断裂。

#### Scenario: 某个主张缺少足够支撑
- **WHEN** 系统识别到 skeleton 某节点只有结论而缺少支撑或存在反例空洞
- **THEN** 系统 SHALL 生成对应 gap prompt
- **AND** 该提示 SHALL 指向具体结构节点与待补信息类型
