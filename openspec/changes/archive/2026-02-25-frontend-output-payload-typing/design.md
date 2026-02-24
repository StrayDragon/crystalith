## Context

前端当前已经有 `normalizeOutputPayload` 与 `decodeOutputItem`，可以在 runtime 将未知 payload 收敛为已知结构或 fallback。
但在消费层（`RefinePanel`）仍有大量 `as any`，以及 API 模型 `ApiOutput` 的 `content` 定义过于宽泛，导致类型系统无法在 `output.type` 分支中稳定提供 narrowing。

## Goals / Non-Goals

**Goals:**
- 让 API 输出模型在类型层明确表达“`type` 与 `content` 的对应关系”。
- 在 `RefinePanel` 中移除 `as any` 读取，使用 decoder + 类型分支渲染。
- 保持 runtime fallback 语义不变，避免因类型收紧引入运行时崩溃。

**Non-Goals:**
- 不修改后端 output schema。
- 不重写所有输出消费组件，本次聚焦 `RefinePanel`（当前 `as any` 最集中区域）。

## Decisions

### 1) API 输出使用判别联合类型
**Decision:** 在 `types.ts` 中将 `ApiOutput` 调整为以 `type` 为判别字段的映射 union，使 `content` 与 `OutputTypeId` 对应。
**Rationale:** 类型关联前移到数据入口，减少后续组件“手动猜类型”的机会。

### 2) RefinePanel 统一走 decoder
**Decision:** 渲染前先尝试 `decodeOutputItem(output)`，成功则走强类型分支，失败则走 JSON fallback。
**Rationale:** 复用现有 runtime guard，避免重复判断逻辑与 `as any`。

### 3) 保留 fallback 路径
**Decision:** 继续允许未知 payload 进入 fallback 渲染，不因类型变更拒绝渲染。
**Rationale:** 后端历史数据或插件扩展 payload 可能暂不满足当前最小 shape，fallback 是兼容性保障。

## Risks / Trade-offs

- **[风险]** 类型收紧后可能暴露历史不规范测试数据 → **缓解**：同步更新测试 fixture，确保 fixture 要么满足类型，要么显式走 fallback。
- **[风险]** RefinePanel 渲染分支调整可能影响 UI 文案细节 → **缓解**：补充组件级行为测试并保持原文案默认值。

## Migration Plan

- 仅前端静态类型与渲染分支重构，无数据迁移。
- 验证步骤：`pnpm test` + `pnpm typecheck`。
