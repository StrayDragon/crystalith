# docs-troubleshooting-hub-and-debug-recipes 规范增量

## ADDED Requirements

### Requirement: Troubleshooting Hub Entries MUST Follow a Consistent Structure
系统 MUST 为排障条目提供一致的结构，以便用户能从“症状”走到“下一步动作”。

#### Scenario: 用户按症状排障
- **WHEN** 用户在 Troubleshooting Hub 中选择某个症状条目
- **THEN** 条目 SHALL 以“症状 → 快速判断 → 具体命令 → 可能原因 → 修复动作 → 结束条件”的结构呈现
- **AND** 命令段 SHALL 包含可复制粘贴的最短检查路径

### Requirement: Plugin Availability Troubleshooting MUST Include Host and Runtime Diagnostics
排障手册 MUST 覆盖“插件可用性”这一类高频问题，并提供宿主与运行时两个视角的诊断入口。

#### Scenario: 用户怀疑能力缺失是插件导致
- **WHEN** 用户遇到“某能力不可用/工具缺失/导入类型不支持”等症状
- **THEN** 排障路径 SHALL 至少包含一次“插件加载/合规检查”的命令入口
- **AND** SHALL 指向运行时 diagnostics（例如 tools 列表中的 plugins/official 状态）以交叉验证

### Requirement: Debug Recipes MUST Be Safe to Share
Debug recipes MUST 默认可安全分享到 issue/工单，不应要求用户粘贴敏感内容。

#### Scenario: 用户导出并分享诊断信息
- **WHEN** 用户按 recipe 收集日志/诊断包用于协作
- **THEN** 文档 SHALL 明确哪些信息需要脱敏以及如何脱敏
- **AND** SHALL 避免要求用户粘贴 secrets、完整正文或私有数据
