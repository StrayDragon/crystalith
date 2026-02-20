## Why

当前所有笔记输出（Studio tools / Slides）在生成时缺少一个明确、可控的“速度 vs 质量”取舍开关：同一套检索/重试策略同时承担“快速迭代”和“最终交付”的诉求，导致要么慢、要么不稳定/质量波动。

后端已具备 `preference = quality|speed` 的调参能力，但前端尚未暴露入口，也未在输出队列与 Slides draft 生成请求中透传该字段；用户无法真正用它来提速或提质。

## What Changes

- 在 Studio 工具生成入口与 Slides 配置中新增“生成倾向”选项（`quality`/`speed`），并持久化为用户偏好（例如 localStorage / workspace store）。
- 输出队列在调用 outputs 与 slides draft 相关接口时透传 `preference`：
  - outputs：`POST /v1/notebooks/{notebook_id}/outputs/{output_type}` body 增加 `preference`
  - slides：draft 的 `generation_config` 增加 `preference` 并在 outline/markdown 两阶段一致生效
- 保持兼容：用户未显式选择时不强制发送 `preference`，沿用现有默认行为（避免无意改变线上默认生成特性）。
-（顺手修复）将现有 Studio 工具“自定义参数”对话框里的选项真正绑定到生成行为（至少影响 prompt 组装/回填），避免 UI 选择“看起来可配但实际上不生效”的误导体验。

## Capabilities

### New Capabilities
- `generation-preference`: 定义 `preference` 的语义、默认行为、与显式 `top_k/min_score` 的优先级规则，以及它如何影响不同输出类型/Slides 的检索与重试策略。

### Modified Capabilities
- `workspace-ui`: Studio tools 与 Slides 配置提供“生成倾向”选择，并在生成/重试/队列中保持一致（含持久化与回填）。
- `studio-slides`: `SlideGenerationConfig` 支持并持久化 `preference`，outline/markdown 两阶段均遵循该倾向。
- `agent-architecture`: OutputGraph 支持可选 `preference`，并将其影响到 ResolveContext（检索参数）与 GenerateOutput（retries 等）。

## Impact

- Frontend
  - Studio：工具配置入口新增 preference 选择；输出队列与重试透传 preference
  - Slides：配置对话框/草稿保存/一键生成链路透传 preference
  - OpenAPI types：前端 generated types 需同步（`preference` 字段）
- Backend
  - API 已具备 preference（outputs / slides generation_config），但需要补齐相关 specs，并确保 UI 端到端覆盖与兼容策略清晰
- 测试/验收
  - 前端：对“选择 preference → 请求透传 → 队列重试一致”的单测/交互测试
  - 后端：最小契约测试（请求不带 preference 与带 preference 的行为一致性）
