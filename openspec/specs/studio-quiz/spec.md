# studio-quiz Specification

## Purpose

定义 Studio 中 QUIZ 类型输出的答题交互：支持选项选择与提交、即时正确性反馈（含解释），并在完成后展示进度与统计结果，形成自测闭环。

## Related specs

- `GLOSSARY.md`
- `workspace-studio-ui/spec.md`
- `output-rendering/spec.md`
- `output-graph/spec.md`

## Requirements
### Requirement: 交互式答题

系统 **MUST** 提供可交互的答题界面。
题目包含选项时用户 MUST 可选择一个选项并提交；提交后系统 MUST 记录当前题目的选择。

### Requirement: 即时反馈

系统 **MUST** 在提交后显示答题反馈。
用户答案正确时 MUST 显示正确状态与解释（如有）；答案错误时 MUST 显示正确答案与解释（如有）。

### Requirement: 进度与结果

系统 **MUST** 提供题目进度与完成结果提示。
答题过程中 MUST 显示当前题号与总题数；完成全部题目后 MUST 显示正确率统计。
