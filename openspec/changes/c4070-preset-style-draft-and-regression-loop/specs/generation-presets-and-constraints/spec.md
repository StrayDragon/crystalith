# generation-presets-and-constraints 规范增量

## ADDED Requirements

### Requirement: Preset Versions MUST Be Traceable on Outputs
系统 MUST 让生成结果可追溯到本次生效的 preset/version 与关键 controls。

#### Scenario: 用户排查某次输出为何变化
- **WHEN** 用户查看某个输出或其版本差异
- **THEN** 系统 SHALL 返回该次生效的 preset 标识、版本与关键控制项
- **AND** SHALL 支持将这些信息用于迁移提示或回归对比

### Requirement: Section Styles MUST Compose with Presets Instead of Replacing Them
系统 MUST 让 section style profiles 建立在 preset controls 之上，而不是互相覆盖成黑盒。

#### Scenario: 某章节覆盖风格档位
- **WHEN** 用户对某个 section 指定 style profile
- **THEN** 系统 SHALL 在 preset 的基础上叠加该章节风格
- **AND** SHALL 保留可解释的 effective controls

### Requirement: Preset Changes MUST Be Reviewable Through Regression Slices
系统 MUST 让 preset 变更能通过 regression slices 与 failure fingerprints 被审视，而不是只依赖人工体感。

#### Scenario: 新版本 preset 上线前复核
- **WHEN** 某个 preset 版本准备替换旧版本
- **THEN** 系统 SHALL 能提供与该 preset 相关的 regression slice 结果或 failure fingerprints
- **AND** SHALL 支持据此给出 migration hint
