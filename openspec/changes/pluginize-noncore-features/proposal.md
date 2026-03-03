## Why

Crystalith 已具备后端插件系统，但当前大量“非系统核心”的能力仍内置在 core 包中（输出类型工具、重依赖解析器、网页提取器等），导致依赖膨胀、升级耦合、以及难以形成可复用/可选装的官方插件生态。基于前置变更 `fullstack-plugin-bundles`（插件可声明前端 UI bundle），现在可以把现有能力拆分为**前后端一体的官方插件**，并让 core 收敛为最小可用框架。

## What Changes

- **BREAKING**：core 不再默认内置“工具输出类型”（FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING/SLIDES）的 schema/prompt/UI 配置；这些能力迁移为官方 `OutputTypePlugin`（可携带 `render_descriptor/config_schema/frontend_bundle`）。
- **BREAKING**：core 解析器瘦身，仅保留最小 ingestion（txt/md/markdown/csv）。PDF/HTML/音视频等迁移为官方 `ParserPlugin`，并把对应重依赖随插件下沉。
- **BREAKING**：网页提取器（trafilatura/jina/firecrawl/browserless）迁移为插件化装配：core 仅保留提取框架与降级编排；具体 extractor 由插件提供并按配置启用。
- 新增：官方插件套件的 monorepo 组织形式（建议 `backend/py/plugins/*` + 前端 builtin bundle registry），统一命名/版本策略与默认启用策略。
- 修改：`/v1/workspace/tools` 由“固定枚举工具集”演进为“基于已安装/已启用插件的动态可用工具集”（必要时提供显式诊断信息与迁移说明）。

## Capabilities

### New Capabilities
- `official-plugins`: 官方插件包的结构、命名、版本与默认启用策略（后端 entry points + 可选前端 builtin bundle）。
- `web-extractor-plugins`: 网页提取器作为插件接口的契约（extractor 类型、可用性判定、fallback 语义）。

### Modified Capabilities
- `architecture-plugin-and-agent`: 扩展插件接口集合（输出/解析/提取器等）并定义冲突与装配边界。
- `studio-output-types`: 输出类型与工具列表从“core 内置”迁移为“插件驱动可用集”，并明确 core 最小集合与扩展集合。
- `source-ingestion-core`: ingestion 能力拆分为 core 最小解析器 + 插件解析器，明确支持矩阵与错误语义。
- `source-ingestion-upload-and-url`: URL 抓取/网页提取的可选依赖与插件化降级策略（含可观测性）。
- `workspace-api-contract`: tools 端点语义从稳定固定集合转为“动态可用集合”，并明确客户端行为与错误语义。
- `output-rendering-and-typing`: 输出渲染优先级与数据契约在“插件拆分后”的稳定行为（含 bundle/descriptor 回退）。
- `config-and-models`: 插件启用策略（allowlist/denylist）、以及官方插件的默认配置入口（如需新增配置项）。

## Impact

- Backend
  - 大量模块迁移：输出 schemas/prompt/default config、解析器实现、网页提取器实现拆包至 `backend/py/plugins/*`。
  - `backend/py/pyproject.toml` 依赖拆分与 workspace members 调整；core 依赖显著收敛。
  - API 语义改变：tools 列表、输出生成能力、解析器支持范围随插件安装/启用变化。
- Frontend
  - 输出渲染依赖后端声明（`render_descriptor/frontend_bundle`）；官方交互 UI 以 builtin bundle 形式随前端构建提供，但是否启用由后端控制。
  - 需要在 UI 上明确“能力未安装/未启用”的提示与指引（基于后端返回的诊断信息）。
- Ops/Docs
  - 部署说明需要新增“安装/启用官方插件套件”的步骤；自托管需明确可选依赖与服务（如 browserless/firecrawl）。
  - 回归测试范围变化：最小 core profile 与 full plugin profile 都需要覆盖。
