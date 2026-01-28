## Context
- 演示配置（选项、主题预设、frontmatter 模板）在前后端双写，且预览逻辑与生成逻辑分离，存在漂移风险（`backend/py/src/crystalith/studio/slides/generator.py`, `frontend/web/src/features/workspace/components/SlidesStudioDialog.tsx`）。
- 多个 UI 组件/Hook 体量过大，数据获取、状态机、UI 渲染、demo 分支交织在一起（如 `frontend/web/src/features/workspace/hooks/useRefine.ts`、`frontend/web/src/features/workspace/components/SlidesStudioDialog.tsx`）。
- Demo 数据分散在多个组件内部，缺少一致的 fixture 来源与统一适配层，造成行为不一致且难以做行为测试。
- 搜索 API 仍返回 TODO 占位消息，与实际搜索链路不一致（`backend/py/src/crystalith/api/sources.py`）。

## Goals / Non-Goals
- Goals:
  - 建立演示配置单一来源，前后端使用同一套配置与模板。
  - 移除 demo 模式与一次性 mock 分支，后端不可用时提供明确错误与空状态。
  - 将大体量组件/Hook 拆分为可维护模块（不改变对外行为）。
  - 增加最小 mock 的前后端行为测试，确保重构不改变关键流程。
- Non-Goals:
  - 不新增业务功能、不改变 UI 视觉设计。
  - 不处理移动端布局缺失等超范围功能问题（另案）。
  - 不替换现有技术栈（FastAPI/Vite/React）。

## Decisions
- Decision: 以“后端配置为单一来源”为原则，新增演示配置 API（含选项、默认值、主题预设模板），后端生成与前端配置 UI/预览均基于该配置。\n  - API 路径使用 `/v1/workspace/tools/slides/config`，与现有 `/v1/workspace/tools`、`/v1/workspace/tools/{tool_id}/config` 的配置入口保持一致。
- Decision: 前端 frontmatter 预览使用同一配置数据与规范化规则生成，确保与后端输出一致。
- Decision: 移除 demo 模式；当后端不可用时，前端以统一的错误/空状态呈现并阻止生成流程继续。
- Decision: 组件拆分优先级：先完成 Slides 配置/对话框拆分与一致性，再处理 Refine/Studio 面板与输出队列拆分。
- Decision: 测试策略以真实依赖为主：数据库、向量存储真实运行；LLM/外部搜索用可控的 deterministic provider（替代而非 mock），前端关键流程使用 Playwright 端到端测试。

## Alternatives considered
- 使用脚本同步前后端常量（可行但仍易遗漏） → 放弃，选择后端配置 API 作为单一来源。
- 共享 JSON 文件供前后端读取 → 需要额外构建/发布步骤，且容易被多处复制 → 放弃。
- 前端全用 MSW mock → 不能验证真实 API 行为 → 放弃。

## Risks / Trade-offs
- 新增配置 API 增加前后端耦合，API 变更需同步。
- 拆分大组件可能引入行为细节差异，需要测试与比对。
- Playwright 端到端测试耗时更长，需控制用例数量。

## Migration Plan
1. 后端新增演示配置模块与 API，前端先增加对新配置的读取路径。
2. 前端切换为优先读取配置 API；确认与后端输出一致后移除旧常量/拼装逻辑。
3. 移除 demo 分支并补齐“后端不可用”错误/空状态展示。
4. 按优先级拆分组件/Hook，并补齐行为测试后再清理旧逻辑。

## Open Questions
- None.
