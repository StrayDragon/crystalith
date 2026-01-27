## ADDED Requirements

### Requirement: 可勾选学习路径

系统 **MUST** 将指南呈现为可勾选的学习路径。

#### Scenario: 显示模块

- **WHEN** 用户打开指南
- **THEN** 每个模块显示为可勾选的卡片
- **AND** 卡片显示模块标题与目标摘要

#### Scenario: 标记完成

- **WHEN** 用户勾选模块完成
- **THEN** 模块显示为已完成状态

### Requirement: 学习进度提示

系统 **MUST** 显示指南的整体完成进度。

#### Scenario: 进度统计

- **WHEN** 用户勾选或取消模块
- **THEN** 进度提示同步更新

### Requirement: 模块折叠

系统 **MUST** 支持模块详情的展开与折叠。

#### Scenario: 展开模块

- **WHEN** 用户点击模块标题或展开按钮
- **THEN** 显示该模块的要点列表

#### Scenario: 折叠模块

- **WHEN** 用户再次点击
- **THEN** 模块详情折叠收起
