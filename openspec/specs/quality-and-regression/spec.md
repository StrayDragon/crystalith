# quality-and-regression Specification

## Purpose

定义工程质量门槛：CI 流水线、回归冒烟、评测基线与测试稳定性约束。

## Non-goals

- 不定义具体业务功能
- 不定义部署拓扑

## Requirements

### Requirement: CI runs on push and pull_request
CI MUST 在 push/PR 触发并提供可见状态检查。

### Requirement: Backend and frontend verification are mandatory
CI MUST 执行后端测试与前端测试+构建。

### Requirement: API/codegen/schema drift checks are mandatory
CI MUST 检查 OpenAPI、生成客户端、配置 schema 与导入分层一致性。

### Requirement: Local default test entrypoints include guardrails
本地默认测试入口 SHOULD 覆盖关键 guardrail 检查，避免问题仅在 CI 暴露。

### Requirement: Minimal API smoke regression suite exists
仓库 MUST 维护核心 API 冒烟回归清单并可执行。

### Requirement: LLM evaluation harness has stable dataset and metrics
评测流程 MUST 定义数据格式与关键回归指标并输出可比报告。

### Requirement: Timing-sensitive tests are deterministic
计时相关测试 MUST 使用可控时间（fake timer/clock）而非真实 wall-clock 阈值。
