# cross-thread-theme-maps-and-subtopic-lattices 规范增量

## ADDED Requirements

### Requirement: Cross-thread Theme Maps MUST Stay Lightweight and Navigational
系统 MUST 让 cross-thread theme maps 作为轻量导航层存在，而不是演化成重型知识图谱工程。

#### Scenario: 用户查看多个线程之间的共享主题
- **WHEN** 用户打开跨线程主题图
- **THEN** 系统 SHALL 突出共享概念、问题或来源簇
- **AND** SHALL 主要服务跳转、聚类与结构理解

### Requirement: Subtopic Lattices MUST Reuse Existing Thread and Memory Semantics
系统 MUST 让 subtopic lattices 建立在已有 threads、memory fragments 与 evidence clusters 之上，而不是发明另一套平行对象体系。

#### Scenario: 系统将大主题拆分为多个子主题
- **WHEN** 某个主题被进一步拆分为子问题或子主题
- **THEN** 系统 SHALL 复用现有 thread、memory 或 evidence 关系来表达
- **AND** SHALL 允许从 lattice 回跳到对应 continuity 对象
