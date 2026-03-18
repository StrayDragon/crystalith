# test-double-usage-reporting Specification

## Purpose

提供可复现的 test doubles 使用报告，用于识别 brittle mocks（例如私有 patch）与热点文件，并指导迁移与防止倒退。

## Non-goals

- 不要求报告直接成为 CI gate（是否 gate 由 `quality-and-regression` 的质量门槛策略决定）
- 不要求对所有语言/前端测试做统一统计（本规范聚焦后端 Python 测试）

## Requirements

### Requirement: Repo provides a stable test-double usage report entrypoint
仓库 MUST 提供稳定入口生成后端测试的 test doubles 使用报告，并确保输出可在本地与 CI 中复现。

#### Scenario: Developer can run the report locally
- **WHEN** 开发者运行 `cd backend/py && just test-mock-report`
- **THEN** 系统 SHALL 输出后端测试的 test doubles 使用统计与热点信息

### Requirement: Report provides machine-readable JSON output
报告工具 MUST 支持以 JSON 输出完整数据，以便后续做基线对比、可视化或 CI 集成。

#### Scenario: JSON mode prints structured data
- **WHEN** 开发者运行报告命令并传入 `--json`
- **THEN** 系统 SHALL 输出包含每个测试文件统计信息的 JSON payload

### Requirement: Report highlights brittle patterns and migration targets
报告 MUST 明确输出以下迁移导航信息：
- 私有 patch 目标（例如 monkeypatch/setattr 指向 `_xxx` 的符号）
- 使用 monkeypatch 但缺少 `Mock reason:` 的文件列表（用于发现不必要或缺乏动机说明的替身）
- hotspot 文件（用于优先治理）

#### Scenario: Report lists private patch targets
- **WHEN** 测试代码存在对私有符号的 patch
- **THEN** 报告 SHALL 列出对应目标与涉及的文件

### Requirement: Report output is deterministic
相同代码基线下，报告输出 MUST 保持确定性（稳定排序、稳定字段、无随机噪声），以便进行可重复的 review 与对比。

#### Scenario: Running the report twice yields identical output
- **WHEN** 在相同代码与环境下连续运行报告两次
- **THEN** 报告 SHALL 输出相同内容（允许时间戳/运行耗时等非核心字段被省略）

### Requirement: Report avoids false positives from strings and comments
报告在检测 `monkeypatch`/`unittest.mock`/私有 patch 目标时 MUST 避免把**字符串字面量**与**注释**中的代码片段误计入统计。

#### Scenario: Code examples in a triple-quoted string do not count
- **GIVEN** 某测试文件仅在三引号字符串里包含 `monkeypatch.setattr("pkg.mod._x", ...)` 这类示例文本
- **WHEN** 运行 `cd backend/py && just test-mock-report`
- **THEN** 报告 SHALL NOT 将该示例文本计入 `monkeypatch ops` / `private patch targets` / `unittest.mock hits`
