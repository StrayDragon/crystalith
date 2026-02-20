## Context

后端已支持“生成倾向”调参（`quality|speed`）并在 outputs 与 slides 两条主链路生效：

- outputs：`POST /v1/notebooks/{notebook_id}/outputs/{output_type}` 支持 `preference`，并在用户未显式传 `top_k/min_score` 时应用倾向默认值；同时影响 agent retries。
- slides：`SlideGenerationConfig` 已包含 `preference`，outline/markdown 两阶段可按倾向调参。

前端目前的问题：

- Studio tools / Slides UI 没有偏好选择与持久化，也没有在 outputs / slides draft 请求中透传 `preference`。
- Studio 工具“自定义参数”对话框提供了数量/难度/主题等选项，但并未影响实际生成请求（存在“看起来可配但不生效”的误导）。

## Goals / Non-Goals

**Goals:**
- 在 Studio tools 与 Slides 配置中提供“生成倾向”选择，并在输出队列、重试、一键生成链路中一致透传。
- 不改变未选择偏好时的默认行为：默认不发送 `preference`（保持后端原有默认调参路径）。
- 将 Studio 工具“自定义参数”对话框中的选项绑定到生成行为（至少影响 prompt 组装与回填）。

**Non-Goals:**
- 不调整后端现有 preference 的调参数值与策略（由后端 tuning 决策维护）。
- 不引入新的后端生成参数协议（数量/难度等本次先通过 prompt 组装落地）。
- 不实现完整的用户账户级偏好同步（本次先做浏览器侧持久化）。

## Decisions

### 1) 偏好在前端的表示与持久化

- 偏好值采用与后端一致的字面量：`"quality" | "speed"`。
- 为了保持兼容与“默认不发送”的约束，前端允许 `null/undefined` 表示“默认（不发送）”。
- 持久化方式优先使用现有模式：localStorage（参考 sources 的 search mode 偏好实现），避免对 `workspaceStore` 引入持久化 middleware 的范围扩大。
  - 建议 key：`crystalith_generation_preference`，值为 `"quality"|"speed"|""`（空串表示默认）。

### 2) outputs 与 slides 的透传路径

- outputs：在 `createOutput` 请求 body 中透传 `preference`（仅当用户选择了非默认）。
  - 触发点：`frontend/web/src/features/workspace/shared/hooks/useOutputQueue.ts` 的 `createOutput` 调用。
- slides：在 slides draft 的 `generation_config` payload 中透传 `preference`（仅当选择了非默认），并确保 outline/markdown 都使用 draft 中的同一 config。
  - 触发点：`frontend/web/src/features/workspace/shared/hooks/useOutputQueue.ts` 的 `createSlidesDraft` 以及 `frontend/web/src/features/workspace/domains/studio/SlidesStudioDialog.tsx` 的 save/create draft payload。

### 3) Studio 工具“自定义参数”对话框如何生效

现阶段最快落地且无需后端协议变更的方式：将数量/难度/主题组合进 prompt 文本（作为 constraints 段落），再走现有的 `prompt` 字段传递。

建议 prompt 结构（示意）：

- 第一段：工具默认 prompt（或用户输入主题）
- 第二段（可选）：Constraints
  - Quantity: `<option.id>`
  - Difficulty: `<option.id>`
  - Topic: `<free text>`

同时在 UI 上明确这些选项是“会影响生成提示词”的参数，避免用户误解为后端硬参数。

## Risks / Trade-offs

- [UI 默认值导致行为改变] → 默认状态不发送 `preference`，并提供“重置为默认”的入口。
- [localStorage 偏好分散在多个组件] → 封装成一个小的 hook（例如 `useGenerationPreference()`）统一读写，减少重复与不一致。
- [用 prompt 承载数量/难度不够强约束] → 先实现可见收益；后续如需更强约束，可在后端引入结构化参数并在 specs/设计中升级。

## Migration Plan

- 向前兼容：仅新增可选字段透传，不影响旧后端；旧前端也可继续不传 `preference`。
- 回滚：回滚前端即可恢复旧行为；后端支持保留不影响。

## Open Questions

- “默认”在 UI 呈现为三态（默认/质量/速度）还是两态（质量/速度 + 重置按钮）更符合产品预期？
- Studio tools 与 Slides 的偏好是否需要分别存储（全局默认 vs per-feature override）？
