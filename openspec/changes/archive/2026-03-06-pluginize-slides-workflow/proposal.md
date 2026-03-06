## Why

当前 `SLIDES` 的端到端工作流仍为 core 内置：后端 slides 生成、`GET /v1/workspace/tools/slides/config` 的独立配置端点、以及前端 Studio 的 slides 专用交互均默认存在。这与 “core-only 可最小化、增强能力由官方插件按需提供” 的方向不一致，也使得后续想要引入不同 slides 引擎/模板体系/可选依赖时难以解耦与交付。

在 `pluginize-noncore-features` 中我们明确暂不处理 slides 插件化，因此需要一个独立变更占位并逐步收敛方案。

## What Changes

- 新增：`SlidesWorkflowPlugin`（或等价接口）用于提供 slides 的生成能力、默认配置与对外声明（含前端 bundle/渲染契约，如适用）。
- 新增：提供一个官方参考插件包（建议命名为 `crystalith-slides-slidev` / plugin id `slides-slidev`），作为“相对复杂”的插件示例，覆盖多阶段生成、丰富配置 schema、预览契约与前端 bundle 装配。
- **BREAKING（预期）**：`SLIDES` 的生成能力从“core 默认可用”演进为“插件驱动可用”（core-only 环境可能不再提供 slides 生成）。
- **BREAKING（预期）**：移除 `GET /v1/workspace/tools/slides/config` 这类 slides 专用配置端点；slides 配置直接收敛到插件声明/工具配置契约（与 tools API 体系一致），不保留旧写法兼容层。
- 新增：对 “slides 能力不可用” 的结构化诊断与 UI 提示（安装/启用插件的可执行指引）。

## Capabilities

### New Capabilities
- `slides-workflow-plugins`: slides 工作流插件接口、声明模型与装配边界（后端插件 + 前端渲染/交互声明）。

### Modified Capabilities
- `studio-slides-workflow`: slides 端点与 draft 工作流在插件化后的稳定语义与降级策略。
- `workspace-api-contract`: tools/diagnostics 如何表达 slides 能力可用性与迁移提示。
- `architecture-plugin-and-agent`: 插件接口集合扩展（新增 slides workflow 类插件）与冲突/装配规则。
- `config-and-models`: slides 插件的启用策略与默认配置入口（如需新增配置项）。
- `workspace-ui-core`: 命令面板、onboarding 与快捷入口如何随 slides 能力可用性动态调整。

## Impact

- Backend
  - slides 生成逻辑与相关依赖将迁移到官方插件包（减轻 core 依赖与升级耦合），并提供一个可供用户参考/二次开发的复杂官方示例插件。
  - API 语义将新增“slides 插件缺失/禁用/不兼容/未选定”的可诊断错误路径。
- Frontend
  - Studio slides UI 需能完全由 tools/plugin 契约驱动，在能力缺失时给出可执行提示，并支持未来多 slides 引擎/模板的可扩展装配。
- Ops/Docs
  - 需要提供 core-only 与带 slides 插件的安装/启用说明、插件选择策略、以及官方参考插件的扩展指引与验收步骤。
