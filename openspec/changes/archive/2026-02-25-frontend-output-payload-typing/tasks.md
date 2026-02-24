## 1. 类型模型收敛

- [x] 1.1 将 `ApiOutput` 调整为以 `OutputTypeId` 为判别字段的 union，建立 `type` 与 `content` 的静态关联。
- [x] 1.2 保持 `normalizeOutputPayload` / `decodeOutputItem` 路径可兼容未知 payload（fallback 不退化）。

## 2. RefinePanel 去除 `as any`

- [x] 2.1 重构 `RefinePanel` 的输出标题与内容渲染分支，改用 typed decoder/类型守卫。
- [x] 2.2 清理该文件内 output 读取的 `as any`，保持未知 payload 的 raw/fallback 渲染。

## 3. 验证

- [x] 3.1 新增或更新前端测试，覆盖 typed 渲染与 fallback 渲染路径。
- [x] 3.2 运行 `cd frontend/web && pnpm test`。
- [x] 3.3 运行 `cd frontend/web && pnpm typecheck`。

## 验证记录

- `cd frontend/web && pnpm test -- src/features/workspace/shared/utils.test.ts src/features/workspace/shared/outputPayload.test.ts` → 通过（83 tests passed）。
- `cd frontend/web && pnpm test` → 通过（83 tests passed）。
- `cd frontend/web && pnpm typecheck` → 通过。
