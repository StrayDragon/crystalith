## Why

当前所有输出类型（FAQ、GUIDE、TIMELINE、MINDMAP、QUIZ、BRIEFING 等）的 schema 和 prompt 都硬编码在核心代码中（`output_schemas.py`、`output_graph.py`、`types.py`）。虽然 `OutputTypePlugin` 接口已经设计好，但没有任何实际的插件实现，该机制从未被验证过。

将部分输出类型提取为独立的插件包可以：
1. **验证 OutputTypePlugin 机制** — 确保插件系统在真实场景中可用
2. **降低核心复杂度** — 将各输出类型的 schema/prompt 解耦到独立包
3. **提供真实示例** — 为第三方开发者展示如何编写 OutputTypePlugin
4. **支持独立演进** — 各输出类型可以独立版本化和迭代

## What Changes

### Phase 1：增强 OutputTypePlugin 扩展属性 + 提取 3 个输出类型

- 保持 `OutputTypePlugin` Protocol 不变，通过 `getattr()` 支持可选扩展属性（`metadata`、`render_descriptor`、`config_schema`）
- 新增 `shared/plugins/render_types.py` 模块，定义扩展属性的 Pydantic 模型
- 修改 `registry.py`，动态检测和存储扩展属性，处理同一 output_type 的冲突
- 提取 **QUIZ**、**TIMELINE**、**MINDMAP** 三个输出类型为独立插件包（自定义 schema，不依赖核心）：
  - `crystalith-output-quiz`
  - `crystalith-output-timeline`
  - `crystalith-output-mindmap`
- 核心保留这三个类型的 schema 作为 fallback（确保向后兼容）
- 将插件包作为 workspace 依赖安装在主项目中

### Phase 1.5：前端通用渲染器

- 后端 `GET /v1/workspace/tools` API 返回 `render_descriptor` 和 `config_schema`
- 前端缓存 render_descriptor 数据，通过 store 传递给 `OutputContent`
- 前端新增 `GenericOutputRenderer` 通用渲染组件，支持 6 种布局（list、cards、tree、timeline、sections、table）
- 渲染优先级：专用插件组件 > GenericOutputRenderer（有 render_descriptor）> JSON fallback
- 已有的专用组件（`FlashcardViewer`、`QuizRunner` 等）继续用于内置输出类型

### Phase 1.6：开发者支持

- 更新 `docs/plugins.md`，添加 OutputTypePlugin 完整开发指南
- 更新 copier 模板，支持选择插件类型（AIProvider / OutputType）

### Phase 2（后续）：提取更多输出类型

- 提取 FAQ、GUIDE、BRIEFING
- 考虑是否移除核心中的 fallback schema（**BREAKING**）

## Impact

- 受影响的规范：`agent-architecture`（插件扩展属性、冲突处理、输出生成流程）、`workspace-ui`（通用渲染器、API 契约）
- 受影响的代码：
  - `backend/py/src/crystalith/shared/plugins/render_types.py` — 新增模块
  - `backend/py/src/crystalith/shared/plugins/registry.py` — 扩展属性存储 + 冲突处理
  - `backend/py/src/crystalith/shared/plugins/compliance.py` — 扩展属性校验
  - `backend/py/src/crystalith/shared/agents/output_graph.py` — 插件优先级逻辑（已有，需验证）
  - `backend/py/src/crystalith/features/workspace/api.py` — tools API 返回 render_descriptor
  - `backend/py/examples/` — 新增 3 个输出类型插件包
  - `backend/py/tools/copier-crystalith-plugin/` — 模板更新
  - `frontend/web/src/features/workspace/domains/outputs/OutputContent.tsx` — 通用渲染器集成
  - `frontend/web/src/features/workspace/domains/outputs/GenericOutputRenderer.tsx` — 新增组件
  - `frontend/web/src/features/workspace/domains/refine/useRefine.ts` — 提取 render_descriptor
  - `docs/plugins.md` — 文档更新
