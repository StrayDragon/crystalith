## Why

虽然工作区已有 `OutputPayload` 和 runtime decoder，但 API 层 `ApiOutput.content` 仍是宽泛对象，且 `RefinePanel` 仍大量依赖 `as any`。这会削弱类型收敛效果，并让渲染分支在重构时更容易出现隐性回归。

## What Changes

- 将前端 API 输出模型补充为以 `OutputTypeId` 为判别字段的 union，`content` 与对应类型建立静态关联，同时保留 fallback 所需的宽松输入能力。
- 重构 `RefinePanel` 输出渲染路径，改用 `decodeOutputItem`/类型守卫进行分支渲染，移除该模块中的 `as any` 访问。
- 增补对应前端测试，锁定 typed/fallback 两条路径在 `RefinePanel` 的行为。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `output-payload-typing`: 强化 API 层与消费端组件对 discriminated union 的落地，减少 `as any` 并保留 fallback 稳定性。

## Impact

- 受影响代码：
  - `frontend/web/src/features/workspace/shared/types.ts`
  - `frontend/web/src/features/workspace/domains/refine/RefinePanel.tsx`
  - `frontend/web/src/features/workspace/shared/outputPayload.ts`（如需补充辅助函数）
  - 相关前端测试文件
- 对外 API 行为无变更，仅提升前端类型安全与可维护性。
