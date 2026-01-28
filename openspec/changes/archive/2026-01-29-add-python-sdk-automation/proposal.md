## Why
- 后端 Python SDK 当前需要手动维护与发布，成本高且容易滞后。
- 需要基于 OpenAPI/AsyncAPI 生成器做充分对比，建立自动化发布流程，并降低后续维护负担。

## What Changes
- 选定 OpenAPI 生成器并记录对比结论（含 AsyncAPI 事件生成的可行性评估）。
- 增加 GitHub Actions：改为手动触发发布（不在 `v*` tag 自动触发），发布前要求已手动生成 SDK 并写入 `sdk/client/python`。
- 明确 SDK 包名/项目名、版本映射规则与 Python 版本支持策略（Python >= 3.10）。

## Impact
- 受影响规范：新增 `python-sdk`。
- 受影响代码/配置：GitHub Actions 工作流、SDK 生成输出路径（`sdk/client/python`）、发布凭据配置、生成器配置文件。
