## Why

- 插件系统与生成链路已具备雏形（entry_points、last-wins、render/config 类型可导入），但对第三方开发者而言仍缺少“可预期的兼容策略”和“可诊断的失败原因”，容易出现不兼容插件静默失效或行为漂移。
- SDK 生成/漂移检查已存在，但发布与示例路径仍偏工程化，缺少面向使用者的最小可用闭环（命名占位、版本策略、示例工程）。

## What Changes

- 明确插件 `api_version` 兼容策略：宿主支持的版本集合、弃用/升级策略、以及不兼容时的结构化诊断输出。
- 强化插件合规检查器：输出机器可读（JSON）报告，包含“为何被跳过/如何修复”的建议，便于 CI 与开发者自检。
- 补齐 SDK 发布与示例文档：Python/TS SDK 的版本对齐策略、生成命令与最小示例项目，降低上手成本。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `architecture-plugin-and-agent`: 增强插件兼容性门禁与诊断输出的稳定契约。

## Impact

- Backend: 插件 registry/合规检查脚本需要输出更结构化的兼容性诊断；文档与模板需要更新。
- Docs/SDK: 补齐 SDK 生成与发布说明（不要求立即发布到公共 registry）。
