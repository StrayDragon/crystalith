## 1. 类型建模与 runtime guards

- [x] 1.1 在 `frontend/web/src/features/workspace/shared/types.ts` 新增 `OutputContentByType` 映射与 `TypedOutputItem` discriminated union（覆盖 FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING/SLIDES/PARAGRAPH/BULLETS/STRUCTURED）
- [x] 1.2 新增 shared decoder/guards（例如 `decodeOutputItem`）：对每种类型做最小 shape 校验（数组字段存在/对象存在/字符串字段存在），失败返回 null/unknown
- [x] 1.3 为 decoder/guards 添加单测（覆盖：正确 narrowing、字段缺失回退、未知类型回退）

## 2. 迁移高复用消费点（减少 any）

- [x] 2.1 修改 `formatStructuredOutputForCopy`：基于 typed union 实现（移除 `as any`）
- [x] 2.2 修改 `frontend/web/src/features/workspace/domains/outputs/exporters.ts`：基于 typed union 构建 JSON/Markdown 导出
- [x] 2.3 修改 `StudioOutputViewer`/`StudioOutputsList`/`WorkspaceLayout` 等读取 `slide_id/title` 的点位：使用 typed narrowing 或 decoder

## 3. 渐进迁移 plugins/renderers（可选但推荐）

- [x] 3.1 将内置 plugins 的 `validateContent`/`render` 改为使用 typed guards（减少重复字段探测）
- [x] 3.2 保留 raw JSON fallback：unknown payload 时仍可展示内容且不崩溃

## 4. 验收（含 DevTools）

- [x] 4.1 `cd frontend/web && pnpm test`
- [x] 4.2 `cd frontend/web && pnpm run typecheck`
- [x] 4.3 启动前后端后，在浏览器 DevTools 中生成各类 outputs（FAQ/QUIZ/SLIDES 等），确认：
  - 控制台无类型相关运行时错误
  - Output 渲染与导出功能正常
