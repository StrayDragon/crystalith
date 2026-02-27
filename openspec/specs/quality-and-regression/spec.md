# quality-and-regression Specification

## Purpose

定义工程质量门槛：CI 流水线、回归冒烟、评测基线与测试稳定性约束。该规范旨在让关键回归尽早暴露并可在本地与 CI 中一致复现。

## Non-goals

- 不定义具体业务功能
- 不定义部署拓扑
## Requirements
### Requirement: CI runs on push and pull_request
CI MUST 在 push/PR 触发并提供可见状态检查。

#### Scenario: CI status is visible on PR
- **WHEN** 开发者提交 PR 或 push 新提交
- **THEN** CI SHALL 触发并在 PR/提交上提供可见状态检查

### Requirement: Backend and frontend verification are mandatory
CI MUST 执行后端测试与前端测试+构建。

#### Scenario: CI runs backend and frontend checks
- **WHEN** CI 运行验证流程
- **THEN** 系统 SHALL 执行后端测试与前端测试+构建（或等价验证）

### Requirement: API/codegen/schema drift checks are mandatory
CI MUST 检查 OpenAPI、生成客户端、配置 schema 与导入分层一致性。

#### Scenario: Drift causes CI failure
- **WHEN** OpenAPI/生成客户端/配置 schema/导入分层与仓库内容不一致
- **THEN** CI SHALL 检测到漂移并失败提示

### Requirement: Local default test entrypoints include guardrails
本地默认测试入口 MUST 覆盖关键 guardrail 检查，避免问题仅在 CI 暴露。

#### Scenario: Local test entrypoints run guardrails
- **WHEN** 开发者在本地运行默认测试入口（如 `just test` 或等价）
- **THEN** 系统 SHALL 同时运行关键 guardrail 检查并在失败时返回非 0

### Requirement: Minimal API smoke regression suite exists
仓库 MUST 维护核心 API 冒烟回归清单并可执行。

#### Scenario: Run smoke regression suite
- **WHEN** 执行核心 API 冒烟回归清单
- **THEN** 系统 SHALL 能稳定运行并覆盖最小关键路径

### Requirement: LLM evaluation harness has stable dataset and metrics
评测流程 MUST 定义数据格式与关键回归指标并输出可比报告。

#### Scenario: LLM eval produces comparable report
- **WHEN** 运行 LLM 评测流程
- **THEN** 系统 SHALL 产出可比报告并包含关键回归指标

### Requirement: Timing-sensitive tests are deterministic
计时相关测试 MUST 使用可控时间（fake timer/clock）而非真实 wall-clock 阈值。

#### Scenario: Timing tests do not flake
- **WHEN** 运行计时敏感的单元/集成测试
- **THEN** 测试 SHALL 使用可控时间源以避免 wall-clock 引入不稳定
