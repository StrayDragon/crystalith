# llm-evaluation Specification

## Purpose

定义本地与 CI 可重复运行的 LLM 评测/回归框架：以固定数据集执行生成并输出机器可读报告，覆盖结构正确性、引用合法性与性能指标，支持对不同版本/配置的回归比较。

## Related specs

- `GLOSSARY.md`
- `generation-observability/spec.md`
- `backend-performance/spec.md`
- `ci-cd/spec.md`

## Requirements
### Requirement: Offline Evaluation Runner
系统 SHALL 提供一个可在本地与 CI 中运行的离线评测工具，用于在固定输入集上重复执行生成并输出报告。

#### Scenario: 运行评测并生成 JSON 报告
- **WHEN** 开发者运行评测工具（脚本/CLI）
- **THEN** 工具 MUST 输出机器可读的 JSON 报告
- **AND** 报告 MUST 包含每个样例的结果与汇总统计

### Requirement: Evaluation Dataset Format
系统 MUST 定义评测样例数据格式，至少包含 `prompt`、`output_type`、`preference` 与最小期望约束（例如 schema pass、citations 合法性）。

#### Scenario: 样例包含最小约束
- **GIVEN** 一个评测样例
- **WHEN** 评测工具执行该样例
- **THEN** 工具 MUST 校验并记录“是否满足最小约束”（例如未 fallback、字段存在、citations 合法）

### Requirement: Metrics for Regression
评测报告 SHOULD 包含结构正确性与性能相关指标（schema pass/fallback/repair、citations 合法性、timings、query_count），以支持回归对比。

#### Scenario: 报告包含关键指标
- **WHEN** 评测工具完成一次运行
- **THEN** 报告 SHOULD 包含 schema pass/fallback/repair 统计
- **AND** SHOULD 包含 query_count 与分阶段耗时（若可获取）
