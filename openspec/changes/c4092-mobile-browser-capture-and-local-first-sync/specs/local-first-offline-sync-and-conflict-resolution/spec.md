# local-first-offline-sync-and-conflict-resolution 规范增量

## ADDED Requirements

### Requirement: Local-First Sync MUST Preserve a Replayable Change Log
系统 MUST 为本地优先对象缓存保留可回放的增量变更日志，而不是只在同步时临时比较当前值。

#### Scenario: 某个设备离线编辑后重新连网
- **WHEN** 设备恢复联网并准备同步离线期间的本地变更
- **THEN** 系统 SHALL 基于可回放的变更日志进行同步
- **AND** SHALL 能解释哪些变更已提交、待确认或被阻塞

### Requirement: Conflict Resolution MUST Distinguish Block-Level and Object-Level Conflicts
系统 MUST 区分 Notebook block 级冲突与 capture/review/source draft 的对象级冲突，而不是统一使用最后写入覆盖。

#### Scenario: Notebook block 与 capture metadata 同时发生冲突
- **WHEN** 同步过程中检测到不同粒度的冲突
- **THEN** 系统 SHALL 区分 block-level conflict 与 object-level conflict
- **AND** SHALL 对每类冲突应用稳定的自动合并、确认或人工决议规则

### Requirement: Offline Eligibility MUST Be Declared Per Object Class
系统 MUST 明确哪些对象可离线创建/修改，哪些对象必须在线确认，避免伪一致性。

#### Scenario: 用户在离线状态创建高风险对象
- **WHEN** 某类对象被标记为需要在线确认
- **THEN** 离线端 SHALL 不把它伪装成已成功同步
- **AND** SHALL 提示该对象仅能进入待确认状态
