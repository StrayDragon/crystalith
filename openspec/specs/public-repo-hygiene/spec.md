# public-repo-hygiene Specification

## Purpose

定义 Crystalith 在公开仓库场景下的最小“工程化 + 用户友好”基线：文档可发现性、贡献路径、安全披露、Issue/PR 模板与项目元数据一致性。该规范用于降低新用户上手成本、减少维护者来回沟通成本，并为后续发布/生态建设提供稳定地基。

## Non-goals

- 不定义业务功能与 API 语义
- 不要求建设复杂的社区治理体系（路线图、自动分流机器人等）

## Requirements

### Requirement: Repo provides a clear contribution entrypoint
仓库 MUST 提供可发现的贡献入口（`CONTRIBUTING.md` 或等价路径），并包含最小开发/测试/提交指导。

#### Scenario: New contributor finds how to run tests
- **WHEN** 新贡献者打开仓库并希望验证改动
- **THEN** 文档 SHALL 提供可执行的测试命令与最小开发步骤

### Requirement: Repo provides a security disclosure policy
仓库 MUST 提供 `SECURITY.md`（或等价安全策略）并说明漏洞报告渠道与响应边界。

#### Scenario: Reporter can find security contact
- **WHEN** 安全研究者需要报告漏洞
- **THEN** 仓库 SHALL 提供清晰的披露渠道与期望信息

### Requirement: Issue and PR templates capture actionable information
仓库 MUST 提供最小的 Issue/PR 模板，以引导提交者提供复现步骤、期望/实际与环境信息，从而减少维护者追问。

#### Scenario: Bug report template includes reproduction details
- **WHEN** 用户提交 bug
- **THEN** 模板 SHALL 引导其提供复现步骤与运行环境（local/compose 等）

### Requirement: Project metadata is not placeholder and is consistent
项目元数据（README、包描述、文档首页等）MUST 避免占位文本，并对“项目是什么/如何运行/如何获取帮助”给出一致表述。

#### Scenario: User sees consistent positioning across entrypoints
- **WHEN** 用户分别查看 README 与包元数据/文档入口
- **THEN** 项目定位与快速开始说明 SHALL 保持一致且可操作
