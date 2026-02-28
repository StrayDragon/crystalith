## Context

当前插件契约：
- 通过 entry_points 发现，冲突 last-wins。
- 支持 `api_version`（但兼容策略与诊断输出需要更明确）。
- 提供合规检查脚本（可输出 JSON）。

SDK 侧：
- OpenAPI 导出与前端生成客户端已在 CI 校验。
- Python SDK 可通过 Fern 生成，但发布/版本对齐/示例仍需产品化。

## Goals / Non-Goals

**Goals:**
- 让第三方插件开发者能“快速知道为什么不工作，并知道怎么修复”。
- 把兼容策略变成可测试、可诊断、可文档化的契约。
- 提升 SDK 与插件生态的可发现性与可复用性（示例工程、模板、文档）。

**Non-Goals:**
- 不在本变更中引入官方插件市场/在线分发体系。
- 不强制改变既有 last-wins 语义（仅增加可见性与诊断）。

## Decisions

- **兼容策略明确化**：宿主声明支持的 `api_version` 集合；插件声明版本不满足时必须被跳过，并给出结构化原因（error_code + message + hint）。
- **合规检查输出稳定化**：`check_plugins.py --json` 输出包含：
  - loaded/skipped 列表
  - skipped 的原因分类（incompatible_version/missing_dependency/invalid_schema/...）
  - 建议修复步骤（可直接用于文档与 CI 注释）
- **SDK 文档化**：明确版本对齐策略（与 backend version 绑定）、生成命令与最小示例（如何初始化 client、如何调用核心 API）。

## Risks / Trade-offs

- [兼容规则更严格导致部分插件无法加载] → 通过清晰诊断与迁移指南降低摩擦；保持向后兼容（支持旧 api_version 一段时间）。
- [文档/模板维护成本] → 优先覆盖“最小可用路径”，按真实使用反馈迭代。

## Migration Plan

- 先定义并实现诊断输出与兼容门禁，再更新文档与模板。
- SDK 发布动作可延后（先保证生成与示例可用）。
