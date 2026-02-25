## Context

- `OutputItem.content` 当前为 `Record<string, unknown>`，消费方普遍通过 `(content as any).foo` + 手动判断来访问结构化字段。
- 多处代码（exporters、copy formatter、plugins、viewer）对同一 output type 重复实现“字段探测”，且缺少统一的回退与校验策略。

## Goals / Non-Goals

**Goals:**
- 引入以 `OutputTypeId` 为判别字段的 `TypedOutputItem`/`OutputPayload` union，让常见输出类型在编译期可安全访问字段。
- 提供轻量 runtime guards/decoder：将 API 返回的 output 解析为 typed 版本；不匹配时回退到 unknown/raw JSON 路径。
- 渐进迁移：先覆盖核心消费点（exporters/formatStructuredOutputForCopy/StudioOutputViewer/OutputContent），再逐步替换其它散落的 `any`。

**Non-Goals:**
- 不要求后端立即提供严格 oneOf OpenAPI schema（本次以前端类型与 runtime guards 为主）。
- 不一次性为所有深层字段提供严格校验（guards 先做“最小可用 narrowing”，必要时再加深）。

## Decisions

### 1) 在 shared/types 中新增 `OutputContentByType` 与 `TypedOutputItem`
**Decision:** 新增映射与 union：
- `OutputContentBase`（可选 `_fallback/_warnings/title` 等通用字段）
- `OutputContentByType`：按 `OutputTypeId` 映射 `content` shape（FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING/SLIDES/PARAGRAPH/BULLETS/STRUCTURED）
- `TypedOutputItem`：将 `type` 与 `content` 绑定为 discriminated union

**Rationale:** 让组件可以通过 `switch(output.type)` 获得可靠 narrowing，消除 `as any`。

### 2) decoder/guards 放在 shared 层，调用点显式选择“typed 或 fallback”
**Decision:** 提供 `decodeOutputItem(output: OutputItem): TypedOutputItem | null`（或 `asTypedOutputItem`），由上层决定：
- typed 分支：字段安全访问
- fallback 分支：走现有 raw JSON / plugin validateContent 逻辑

**Rationale:** 不强制全局改动，允许逐步迁移；同时让失败回退行为明确且可测试。

### 3) 先迁移“结构化导出/复制/标题解析”等高价值公共函数
**Decision:** 优先修改：
- `formatStructuredOutputForCopy`
- `buildJsonExport`/`buildMarkdownExport`
- `resolveOutputTitle`
使其基于 typed union 实现，成为其他组件的单一来源。

**Rationale:** 这些函数被多处复用，是减少重复与 `any` 的杠杆点。

## Risks / Trade-offs

- **[风险]** typed guards 过严导致过多回退 → **缓解**：guards 采用“最小必要字段”策略；并保留 raw JSON 回退确保不破坏渲染。
- **[风险]** 渐进迁移期间存在 typed 与 untyped 并存 → **缓解**：约定新代码优先使用 typed API，并在 tasks 中列出需要替换的主要 `as any` 点位。

## Migration Plan

1. 引入 types + guards + 单测。
2. 迁移 shared utils/exporters 等公共路径。
3. 逐步迁移 plugins/renderers，删除散落的 `any`。

## Open Questions

- 是否需要引入更强的 schema validator（例如 zod）来统一运行时校验？（本次先不引入新依赖）
