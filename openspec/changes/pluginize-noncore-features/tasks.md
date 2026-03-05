## 1. 官方插件工程结构（monorepo）

- [x] 1.1 新增 `backend/py/plugins/*` 目录结构，并将其加入 `backend/py/pyproject.toml` 的 workspace members（形成官方插件套件的落点）。
- [x] 1.2 明确 `backend/py/examples/*` 继续仅作为示例（不作为官方插件套件的安装入口），避免两套并行不清晰。
- [x] 1.3 定义“core-only / official-full”的推荐安装方式（dependency groups / extras 或等价机制），并明确各 bundle 覆盖的能力集合。
- [x] 1.4 记录官方插件 id 命名约定（`output-*` / `parser-*` / `extractor-*`）与默认启用策略（已安装即默认启用；allowlist/denylist 可覆盖）。

## 2. Backend：工具输出类型迁移为官方 OutputTypePlugin

- [x] 2.1 为 FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING 创建官方 `OutputTypePlugin`（schema/default_prompt/metadata/render_descriptor/config_schema/frontend_bundle）。
- [ ] 2.2 明确 `SLIDES` 工作流暂不在本变更内插件化（另立变更 `pluginize-slides-workflow`）；本变更保持 slides endpoints 与 `GET /v1/workspace/tools/slides/config` 内置可用。
- [ ] 2.3 将 core 内置的工具输出类型配置迁出（prompt/tool config/frontend bundle mapping 等），确保 core 不再硬编码“固定工具集”。
- [ ] 2.4 改造输出生成图：优先使用插件 schema/prompt；core 仅保留最小输出类型（如 paragraph/bullets/structured）的内置 schema 以保证 core-only 可用。
- [ ] 2.5 为工具输出类型加入生成门禁：当缺失对应 `OutputTypePlugin` 时 `POST /v1/notebooks/{notebook_id}/outputs/{output_type}` 返回稳定错误信封（建议 409）+ `required_plugin_id` + 可执行 `recovery_hint`。
- [ ] 2.6 增补/更新后端测试：插件 schema 生效；缺插件时返回稳定错误码与提示（而不是回退 core schema）。

## 3. Backend：`/v1/workspace/tools` 动态化 + 结构化诊断

- [ ] 3.1 将 tools 列表构建改为“仅返回可用 tools”：工具输出类型来自已加载且兼容的 `OutputTypePlugin`；`SLIDES` 作为 core 内置 tool 暂保留。
- [ ] 3.2 在 tools 响应中新增 `diagnostics` 字段并固定结构：`diagnostics.plugins.loaded/skipped`（覆盖 disabled/incompatible_version/missing_dependency/load_error 等）。
- [ ] 3.3 增加轻量 `diagnostics.official`（覆盖全部官方插件的 catalog 状态：loaded/skipped/not_installed），用于解释“官方插件未安装（无 entry point）”的能力缺失，并给出可执行安装/启用提示。
- [ ] 3.4 若 OpenAPI 发生变更：更新后端 OpenAPI，并运行 `cd frontend/web && pnpm run api:sync` 修复前端类型漂移。

## 4. Backend：解析器插件化（core 最小 ingestion）

- [ ] 4.1 将 PDF/HTML/音频/视频解析器迁移为官方 `ParserPlugin`（拆出重依赖到插件包，core 仅保留 txt/md/markdown/csv）。
- [ ] 4.2 在 `config/app.yaml` 中新增 `plugins.load_order` 并纳入 schema，用于确定性冲突裁决（配置优先，否则按 plugin_id 排序）。
- [ ] 4.3 调整 `ParserFactory` 选择策略为“插件优先、core 最小兜底”（或等价一致策略），并确保选择规则可预测（含多插件命中的 tie-break）。
- [ ] 4.4 为“不支持格式”补齐可诊断错误：415 的 details 中包含推荐的 `parser-*` 插件 id 与恢复提示。
- [ ] 4.5 将最终生效的 parser `plugin_id` 写入来源元数据（例如 `parser_plugin_id`）并可在诊断中查询。
- [ ] 4.6 增补/更新测试：core-only 下上传 PDF/HTML 返回稳定 415；安装插件后解析成功且 `parser_type`/`parser_plugin_id` 可观测。

## 5. Backend：网页提取器插件化（ExtractorFactory 保留编排）

- [ ] 5.1 定义 `WebExtractorPlugin`（或等价接口）与共享 types（提取结果模型、结构化错误/诊断模型）。
- [ ] 5.2 扩展 `PluginRegistry` 支持 extractor plugins（注册、冲突 last-wins、记录最终生效 plugin id 以供诊断）。
- [ ] 5.3 将 trafilatura/jina/firecrawl/browserless 提取器实现迁移为官方插件（拆出依赖与可选服务连接逻辑）。
- [ ] 5.4 重构 `ExtractorFactory` 为“从插件装配实现、core 负责 fallback/retry/代理/SSRF 校验”，并保持既有降级语义稳定。
- [ ] 5.5 更新 `GET /v1/notebooks/{notebook_id}/sources/extractors` 与 `from-url fetch`：清单与错误提示反映插件 enabled/available 状态与恢复提示；补齐测试覆盖。
- [ ] 5.6 增加 notebook 级别的 extractor 策略（存数据库）：支持 `mode=inherit_global|custom`，并提供 `PATCH /v1/notebooks/{notebook_id}/sources/extractors` 写入 mode 与启用覆盖（UI 可切换），effective enabled 参与 extractor 选择与 fallback。
- [ ] 5.7 增补/更新测试：notebook 覆盖生效；preferred extractor 不可用时行为（报错或回退）可诊断且可预测。

## 6. Frontend：动态工具集与缺失能力提示

- [ ] 6.1 更新工具选择与 refine 入口：不再假设固定输出类型集合，完全以 tools API 返回为准。
- [ ] 6.2 将 tools API 的 `diagnostics` 映射为 UI 提示（未安装/未启用/依赖缺失/版本不兼容），并展示可执行指引（安装/启用对应 `output-*`/`parser-*`/`extractor-*`）。
- [ ] 6.3 为 extractor 清单增加“遵循全局/自定义”切换 + “启用/禁用”UI（notebook 级别持久化策略），并确保 fetch 时仅使用 enabled 的 extractors。
- [ ] 6.4 验证输出渲染安全降级：bundle 缺失或不兼容时回退到 `render_descriptor` / Raw JSON，不崩溃。

## 7. 依赖收敛与文档/迁移

- [ ] 7.1 清理 core `backend/py/pyproject.toml`：将 pypdf/trafilatura/firecrawl-py/playwright/bs4/lxml 等重依赖迁移到对应插件包（core-only 不再需要）。
- [ ] 7.2 更新部署与配置文档：说明 core-only / official-full 的安装方式、能力矩阵、以及插件启用策略（allowlist/denylist）。
- [ ] 7.3 更新示例配置：展示如何启用/禁用官方插件、如何配置 browserless/firecrawl 等可选依赖与恢复提示。

## 8. Verification（测试与人工验收）

- [ ] 8.1 后端：运行 `cd backend/py && just test`（至少覆盖 plugins/tools/sources）。
- [ ] 8.2 前端：运行 `cd frontend/web && pnpm test && pnpm typecheck`。
- [ ] 8.3 手工验收：core-only 启动成功；上传 PDF/HTML/音视频给出可诊断 415；from-url fetch 在 extractor 缺失时提示；安装官方插件后能力恢复。
- [ ] 8.4 若 OpenAPI 变化：再次运行 `cd frontend/web && pnpm run api:sync` 并确认 UI 工作流无类型漂移。

## 执行记录

- （待执行）`cd backend/py && just test`
- （待执行）`cd frontend/web && pnpm test && pnpm typecheck`
