## Why

当前 Crystalith 的后端插件系统（`crystalith.plugins` entry points）已经能扩展输出 schema / render_descriptor / config_schema，但**有一类插件必然需要前端自定义交互 UI**（例如测验运行器、思维导图交互、富文本/结构化报告等）。现状是前端用一套硬编码的输出渲染“插件注册表”实现交互 UI，这与后端插件生态割裂，导致：

- 后端插件无法声明/携带对应的前端渲染器，插件无法做到“前后端一体交付”
- 在后续把现有功能拆分为官方插件时，前端仍需要改 core 代码才能支持新插件 UI

因此需要建立一个稳定的“前后端联动插件 bundle 契约”，作为后续插件拆分的前置基础设施。

## What Changes

- 新增：后端 `OutputTypePlugin` 可选声明 `frontend_bundle`（声明式描述“前端渲染器 bundle”）。
- 新增：`/v1/workspace/tools` 的 tool 对象可选返回 `frontend_bundle`，供前端发现并按需启用。
- 新增：前端内置 `builtin` bundle registry（构建期集成，运行期开关），按 `frontend_bundle` 动态 `import()` 对应渲染器。
- 修改：输出渲染优先级明确为 `frontend_bundle renderer > GenericOutputRenderer > Raw JSON`。
- 版本策略：`frontend_bundle.api_version` 独立于后端插件 `api_version`，由前端显式 gate；不兼容或加载失败必须有可预测回退路径。

> 注：本变更 **不引入运行期远程加载第三方代码**（URL/ESM/iframe）。v1 仅支持 `kind="builtin"`，用于官方插件与单仓库内的前后端 bundle。

## Capabilities

### New Capabilities
- `fullstack-plugin-bundles`: 定义后端如何声明前端 bundle、前端如何加载/版本协商/失败回退的契约。

### Modified Capabilities
- `architecture-plugin-and-agent`: 扩展插件契约以允许输出类型插件携带前端 bundle 描述符（不改变 entry points 发现机制）。
- `output-rendering-and-typing`: 更新渲染优先级与动态加载行为，使“专用渲染器”可由后端声明驱动。
- `workspace-api-contract`: `/v1/workspace/tools` 增加可选字段（`frontend_bundle`）并定义其稳定语义。

## Impact

- Backend
  - `crystalith.shared.plugins`：新增共享类型（`FrontendBundleDescriptor`）并扩展 `OutputTypePlugin` 协议。
  - `GET /v1/workspace/tools`：响应对象新增可选字段（OpenAPI 变化需同步前端生成代码）。
- Frontend
  - Workspace store 增加 per-output-type 的 bundle 描述符缓存。
  - `OutputContent` 渲染链路引入 bundle loader（lazy import）与错误回退。
- Testing/Docs
  - 增加后端与前端的单元测试覆盖 bundle 选择、加载失败回退。
  - 更新插件文档，明确 v1 仅支持 builtin bundle 与安全边界。
