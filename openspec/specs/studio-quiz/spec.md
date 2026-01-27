# studio-quiz Specification

## Purpose
TBD - created by archiving change enhance-studio-quiz. Update Purpose after archive.
## Requirements
### Requirement: 交互式答题

系统 **MUST** 提供可交互的答题界面。

#### Scenario: 选择选项

- **WHEN** 题目包含选项
- **THEN** 用户可选择一个选项作为答案

#### Scenario: 提交答案

- **WHEN** 用户点击提交
- **THEN** 系统记录当前题目的选择

### Requirement: 即时反馈

系统 **MUST** 在提交后显示答题反馈。

#### Scenario: 正确反馈

- **WHEN** 用户答案正确
- **THEN** 显示正确状态与解释（如有）

#### Scenario: 错误反馈

- **WHEN** 用户答案错误
- **THEN** 显示正确答案与解释（如有）

### Requirement: 进度与结果

系统 **MUST** 提供题目进度与完成结果提示。

#### Scenario: 进度提示

- **WHEN** 用户答题
- **THEN** 显示当前题号与总题数

#### Scenario: 完成结果

- **WHEN** 用户完成全部题目
- **THEN** 显示正确率统计
