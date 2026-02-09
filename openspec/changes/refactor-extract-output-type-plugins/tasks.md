## 1. 增强 OutputTypePlugin 扩展属性支持
- [ ] 1.1 创建 `shared/plugins/render_types.py`，定义 `OutputTypePluginMeta`、`RenderDescriptor`、`ItemSchema`、`FieldDescriptor`、`PluginConfigSchema`、`ConfigOption` 模型
- [ ] 1.2 更新 `registry.py`：使用 `getattr()` 动态检测插件的 `metadata`、`render_descriptor`、`config_schema`，存储到独立的 dict 中
- [ ] 1.3 更新 `registry.py`：添加同一 `output_type` 冲突检测和警告日志
- [ ] 1.4 更新 `registry.py`：添加 `get_output_type_metadata()`、`get_render_descriptor()`、`get_config_schema()` 查询方法
- [ ] 1.5 更新 `compliance.py`：校验可选扩展属性的类型（metadata 是 OutputTypePluginMeta、render_descriptor 是 RenderDescriptor 等）
- [ ] 1.6 **不修改** `interfaces.py` 中的 `OutputTypePlugin` Protocol（保持向后兼容）

## 2. 后端 API 增强
- [ ] 2.1 修改 `features/workspace/api.py`：在构建 tools 响应时，从 `PluginRegistry` 注入 `render_descriptor` 和 `config_schema`
- [ ] 2.2 更新 workspace tools 的响应 schema，新增 `render_descriptor: RenderDescriptor | None` 和 `config_schema: PluginConfigSchema | None` 字段
- [ ] 2.3 确保新字段为 `nullable`，后端未更新时前端能优雅降级
- [ ] 2.4 更新 OpenAPI schema，前端执行 `pnpm run api:generate` 重新生成 API 客户端

## 3. 创建输出类型插件包
- [ ] 3.1 创建 `crystalith-output-quiz` 插件包：
  - 自定义 `QuizOutput` schema（不依赖核心 `output_schemas.py`）
  - 提供 `default_prompt`、`metadata`、`render_descriptor`、`config_schema`
  - 通过 `entry_points` 注册到 `crystalith.plugins`
- [ ] 3.2 创建 `crystalith-output-timeline` 插件包（同上结构）
- [ ] 3.3 创建 `crystalith-output-mindmap` 插件包（同上结构）
- [ ] 3.4 在主项目 `pyproject.toml` 中添加为 workspace 开发依赖
- [ ] 3.5 验证：`scripts/check_plugins.py` 对三个插件包均报告合规

## 4. 前端通用渲染器
- [ ] 4.1 定义 `RenderDescriptor`、`FieldDescriptor`、`PluginConfigSchema` TypeScript 类型（与后端 `render_types.py` 对齐）
- [ ] 4.2 修改 `useRefine.ts` 中的 `normalizeTool()`：提取 `render_descriptor` 和 `config_schema`
- [ ] 4.3 在 `useWorkspaceStore` 中存储 `outputType → renderDescriptor` 映射，供 `OutputContent` 查询
- [ ] 4.4 实现 `GenericOutputRenderer` 组件，根据 `render_descriptor.layout` 分发到对应布局组件
- [ ] 4.5 实现 6 种通用布局子组件：`GenericList`、`GenericCards`、`GenericTree`、`GenericTimeline`、`GenericSections`、`GenericTable`
- [ ] 4.6 修改 `OutputContent.tsx`：渲染优先级 — 专用插件 > GenericOutputRenderer（有 render_descriptor）> JSON fallback
- [ ] 4.7 编写 `GenericOutputRenderer` 单元测试：
  - 每种布局类型至少一个测试用例
  - 缺少 render_descriptor 时 fallback 到 JSON
  - 无效 layout 类型时 fallback 到 JSON
  - 嵌套 FieldDescriptor 的渲染

## 5. 后端验证插件覆盖机制
- [ ] 5.1 编写测试：mock `entry_points` 注册一个 OutputTypePlugin，验证 `PluginRegistry` 正确存储 schema、prompt、metadata、render_descriptor
- [ ] 5.2 编写测试：`GenerateOutput` 节点在有插件时使用插件 schema，无插件时使用 fallback
- [ ] 5.3 编写测试：两个插件注册同一 `output_type` 时，后者覆盖前者并记录警告
- [ ] 5.4 编写测试：插件不提供 metadata/render_descriptor 时，注册正常且 `getattr` 返回 None
- [ ] 5.5 编写测试：`GET /v1/workspace/tools` 返回的 tool 包含正确的 render_descriptor（有插件时）和 null（无插件时）

## 6. 更新开发者支持
- [ ] 6.1 更新 `docs/plugins.md`：添加 OutputTypePlugin 开发指南，包含：
  - 基础接口（output_type、schema、default_prompt）
  - 可选扩展属性（metadata、render_descriptor、config_schema）
  - 完整示例代码
- [ ] 6.2 更新 copier 模板：添加插件类型选择（AIProvider / OutputType）
- [ ] 6.3 更新 copier 模板：OutputTypePlugin 脚手架包含 render_descriptor 和 config_schema 示例

## 7. 端到端验证
- [ ] 7.1 `cd backend/py && just test` 全部通过
- [ ] 7.2 `cd frontend/web && pnpm test` 全部通过
- [ ] 7.3 `cd frontend/web && pnpm run build` 构建成功
- [ ] 7.4 手动验证：生成 QUIZ/TIMELINE/MINDMAP 输出，确认插件 schema 生效
- [ ] 7.5 手动验证：禁用插件后，fallback schema 正常工作
- [ ] 7.6 手动验证：通用渲染器能正确渲染插件输出类型（检查 6 种布局）
- [ ] 7.7 手动验证：前端在后端未返回 render_descriptor 时优雅降级到 JSON
