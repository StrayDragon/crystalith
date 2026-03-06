## 1. Shared plugin contracts and config model

- [x] 1.1 新增 `SlidesWorkflowPlugin` 及其共享 metadata / config / preview descriptor 类型，并把它接入 plugin registry、compliance 与 `slides-*` 官方插件命名约定。
- [x] 1.2 在配置模型与 schema 中新增 `slides.default_plugin`（或等价字段），实现 active slides plugin 的确定性选择与缺失/冲突诊断。
- [x] 1.3 将当前偏 output-only 的 tool config 模型升级为统一的 rich `config_schema` 契约，并同步更新 `/v1/workspace/tools`、OpenAPI 与前端 generated types。

## 2. Backend：core slides 切到 plugin-backed

- [x] 2.1 移除 `/v1/workspace/tools` 中对 built-in `SLIDES` 的硬编码注入，并删除 `/v1/workspace/tools/slides/config` 专用端点。
- [x] 2.2 保留 slides draft CRUD / SSE / output sync / preview 文件落盘在 core，但将 outline / markdown 生成与默认配置委托给 active slides plugin。
- [x] 2.3 为 tools API 与 slides endpoints 增加稳定的 unavailable 诊断语义，覆盖 missing / disabled / incompatible / ambiguous-active-plugin 等场景。

## 3. 官方参考插件：`crystalith-slides-slidev`

- [x] 3.1 新建 `backend/py/plugins/crystalith-slides-slidev`，注册 `slides-slidev` entry point，并将当前 Slidev-specific slides 生成与默认配置迁入该插件。
- [x] 3.2 让参考插件导出完整的 slides config schema（quantity / audience / structure / tone / language / density / theme / frontmatter）、preview 契约与 frontend bundle 元数据。
- [x] 3.3 更新 official catalog、安装方式、README 与插件开发说明，把该插件作为“复杂参考插件”样板对外说明。

## 4. Frontend：slides UI 改为完全 tools-driven

- [x] 4.1 将 `SlidesStudioDialog` 改为从 `/v1/workspace/tools` 读取 `SLIDES` tool 的 `config_schema`，移除对 slides 专用 config API 的依赖。
- [x] 4.2 将 Studio tools grid、命令面板、onboarding 与其它 slides 入口改为随 `SLIDES` tool availability 动态显示；能力缺失时展示 diagnostics / official catalog 中的恢复提示。
- [x] 4.3 将 slides 预览与相关前端 bundle 装配改为读取 active plugin 声明的 engine / preview metadata，而不是硬编码 Slidev 假设。

## 5. 验证与文档

- [x] 5.1 补充后端测试：`SlidesWorkflowPlugin` 发现/选择、tools diagnostics、slides unavailable 错误路径、plugin-backed slides endpoints。
- [x] 5.2 补充前端测试：tools-driven slides gating、slides 配置渲染、缺失能力提示、命令面板/onboarding 的动态入口。
- [x] 5.3 运行并记录验证：`cd backend/py && uv run pytest`（至少相关测试子集）、`cd frontend/web && pnpm test`、`cd frontend/web && pnpm typecheck`；若 OpenAPI 或配置 schema 变更，补跑 `pnpm run api:sync` 与 `cd backend/py && just config-schema`，并更新 self-host 安装说明。
  - [x] `cd backend/py && just config-schema`
  - [x] `cd backend/py && uv run pytest --no-cov tests/shared/test_plugin_compliance.py tests/test_plugins.py tests/features/workspace/test_workspace_tools_api.py tests/features/slides/test_slides_api.py tests/features/slides/test_slides_streaming.py -q` → `50 passed`
  - [x] `cd frontend/web && pnpm run api:sync`（本变更实现过程中已执行，用于同步 generated client）
  - [x] `cd frontend/web && pnpm test` → `106 passed`
  - [x] `cd frontend/web && pnpm typecheck`
  - [x] 更新 self-host / plugin 安装说明：`backend/py/plugins/README.md`、`backend/py/plugins/crystalith-slides-slidev/README.md`
