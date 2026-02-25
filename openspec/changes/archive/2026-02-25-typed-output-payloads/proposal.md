## Why

前端当前将 `OutputItem.content` 建模为 `Record<string, unknown>`，导致大量消费方需要 `as any`/手写字段探测来访问 `items/modules/outline/...` 等结构化字段。这会带来：

- 编译期无法发现字段错误（类型系统失效）
- 渲染路径分散且重复（每个组件都在做相似的“猜 shape”）
- 运行时更容易出现 undefined/null 访问错误

需要把 Output payload 建模为 **以 `OutputTypeId` 为判别字段的 discriminated union**，并配套 runtime guards（在接收 API 数据时做最小校验/归一化），让组件在编译期获得可靠 narrowing，减少 `any`。

## What Changes

- 定义 `OutputPayload` 的 discriminated union（按 `OutputTypeId` 映射 `content` 结构）；对尚未覆盖的类型保留 `UnknownOutputPayload` 回退。
- 提供 runtime guards/decoder：将 API 返回的 `OutputItem` 解析为 `TypedOutputItem`（或在 selector 层归一化），并在不匹配时回退到 raw JSON 渲染路径。
- 逐步替换消费方的 `as any`：让 `OutputContent`/plugins/utilities 通过类型 narrowing 访问字段。
- 增加单测：guards/decoder 的覆盖，以及关键渲染路径在 unknown payload 下的回退行为。

## Capabilities

### New Capabilities
- `output-payload-typing`: 定义前端 Output payload 的类型建模、runtime guards 与回退策略。

### Modified Capabilities
- （无）

## Impact

- 受影响代码（预计）：
  - `frontend/web/src/features/workspace/shared/types.ts`
  - `frontend/web/src/features/workspace/**/Output*`、plugins 与相关 utils
  - 前端测试（Vitest）
- 风险：
  - 初期类型覆盖不全 → 通过 `UnknownOutputPayload` 与 “raw JSON fallback” 保持兼容，逐步扩展覆盖面
