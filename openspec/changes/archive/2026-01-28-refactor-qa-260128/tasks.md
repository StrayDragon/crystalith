## 1. Backend refactor
- [x] 1.1 抽取演示配置（选项/默认值/主题预设模板）到独立模块，并让 `studio/slides` 生成逻辑使用该模块
- [x] 1.2 新增演示配置 API（`/v1/workspace/tools/slides/config`），返回选项、默认值与主题预设模板（含字段顺序）并更新 OpenAPI
- [x] 1.3 修正搜索 API 的 message 来源，移除 TODO 占位文本，确保与搜索摘要一致

## 2. Frontend refactor
- [x] 2.1 新增 slidesConfig client 模块，进入演示配置时优先读取后端配置
- [x] 2.2 重构 `SlidesStudioDialog`：拆分配置表单/预览/编辑区，抽取 frontmatter 预览与 normalize 逻辑到 utils
- [x] 2.3 移除 demo 分支与 mock 数据路径；后端不可用时提供明确错误/空状态并阻止生成流程
- [x] 2.4 拆分 `useRefine`（输出队列、模板定义）与 `StudioPanel`（工具卡片、输出列表）以降低复杂度

## 3. Behavior tests (minimal mock)
- [x] 3.1 后端：新增/更新集成测试覆盖 slides 配置 API、frontmatter 一致性、搜索 message 行为（使用 deterministic provider）
- [x] 3.2 前端：新增 Playwright 端到端测试覆盖“演示配置加载 + 预览一致性”“搜索队列展示”
- [x] 3.3 前端：新增 Vitest 组件测试验证 slides 配置渲染与“后端不可用”错误状态（仅对 API 边界做轻量 mock）

## 4. Validation
- [x] 4.1 运行 `cd backend/py && just test`（或至少相关测试集）
- [x] 4.2 运行 `cd frontend/web && pnpm test` 与 `pnpm test:e2e`
- [x] 4.3 如果 OpenAPI 有改动，运行 `cd frontend/web && pnpm run api:check` 与 `pnpm run api:generate`
