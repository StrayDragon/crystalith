# 功能对照矩阵（User ↔ Server）

用户 UI 功能与 Server 路由映射。`Status`: **active** = 主路径挂载；**orphan** = 有代码无入口；**api-only** = 仅 API 且仍有意保留；**dead-candidate** = 无用户功能、以代码为准可移除（文档已对齐，代码未删）。

| Feature ID                      | User UI         | Server routes                                                           | Status         | 备注                                                       |
| ------------------------------- | --------------- | ----------------------------------------------------------------------- | -------------- | ---------------------------------------------------------- |
| `workspace-app-shell`           | 工作区根布局    | `GET /health`                                                           | active         | 待盘点                                                     |
| `workspace-header`              | 顶栏            | `GET /v2/notebooks`                                                     | active         | 待盘点                                                     |
| `workspace-onboarding-banner`   | 引导横幅        | `POST /v2/notebooks`                                                    | active         | 待盘点                                                     |
| `workspace-auto-notebook-hint`  | 自动笔记本提示  | `POST /v2/notebooks`                                                    | active         | 待盘点                                                     |
| `modular-canvas-layout`         | 三栏画布        | —                                                                       | active         | 待盘点                                                     |
| `widget-catalog`                | 模块目录        | —                                                                       | active         | 待盘点                                                     |
| `layout-lock-toggle`            | 布局锁定        | —                                                                       | active         | 待盘点                                                     |
| `mobile-panel-tabs`             | 移动 Tab        | —                                                                       | active         | 待盘点                                                     |
| `mobile-panel-shell`            | 移动面板壳      | —                                                                       | active         | 待盘点                                                     |
| `shortcut-help-panel`           | 快捷键帮助      | —                                                                       | active         | 待盘点                                                     |
| `global-keyboard-shortcuts`     | 全局快捷键      | —                                                                       | active         | 待盘点                                                     |
| `theme-switcher`                | 主题切换        | —                                                                       | active         | 待盘点                                                     |
| `app-error-boundary`            | 应用错误边界    | —                                                                       | active         | 待盘点                                                     |
| `widget-error-boundary`         | 模块错误边界    | —                                                                       | active         | 待盘点                                                     |
| `toast-notifications`           | Toast           | —                                                                       | active         | 待盘点                                                     |
| `notebook-switcher`             | 笔记本切换      | `GET /v2/notebooks`                                                     | active         | 待盘点                                                     |
| `notebook-create`               | 新建笔记本      | `POST /v2/notebooks`                                                    | active         | 待盘点                                                     |
| `notebook-rename`               | 重命名          | `PATCH /v2/notebooks/:nid`                                              | active         | 待盘点                                                     |
| `notebook-delete`               | 删除            | `DELETE /v2/notebooks/:nid`                                             | active         | 待盘点                                                     |
| `notebook-switch`               | 切换活动笔记本  | `GET /v2/notebooks/:nid`                                                | active         | 待盘点                                                     |
| `template-picker`               | 模板选择        | `GET /v2/templates`, `POST /v2/notebooks`                               | active         | 待盘点                                                     |
| `template-manager`              | 模板管理        | `GET/PATCH/DELETE /v2/templates/:id`                                    | active         | 待盘点                                                     |
| `save-notebook-as-template`     | 另存模板        | `POST /v2/templates`                                                    | active         | 待盘点                                                     |
| `session-switcher`              | 会话切换        | `GET /v2/notebooks/:nid/sessions`                                       | active         | 待盘点                                                     |
| `session-create`                | 新建会话        | `POST /v2/notebooks/:nid/sessions`                                      | active         | 待盘点                                                     |
| `session-rename-delete`         | 重命名/删除会话 | `PATCH/DELETE .../sessions/:sid`                                        | active         | 待盘点                                                     |
| `chat-panel`                    | 对话面板        | `GET/POST .../messages`, `POST /v2/qa/stream`                           | active         | 待盘点                                                     |
| `chat-send-message`             | 发送消息        | `POST .../messages`, `POST /v2/qa/stream`                               | active         | 待盘点                                                     |
| `chat-stop-streaming`           | 停止流式        | （中断 stream）                                                         | active         | 待盘点                                                     |
| `chat-slash-commands`           | 斜杠命令        | `GET /v2/commands`                                                      | active         | 待盘点                                                     |
| `chat-retry-send`               | 重试发送        | `POST /v2/qa/stream`                                                    | active         | 待盘点                                                     |
| `chat-retry-load-messages`      | 重试加载        | `GET .../messages`                                                      | active         | 待盘点                                                     |
| `chat-message-copy`             | 复制消息        | —                                                                       | active         | 待盘点                                                     |
| `chat-message-save-to-note`     | 存到笔记        | `POST /v2/outputs`                                                      | active         | 待盘点                                                     |
| `chat-message-export`           | 导出消息        | —                                                                       | active         | 待盘点                                                     |
| `chat-session-export`           | 导出会话        | `GET /v2/qa/export`                                                     | active         | 待盘点                                                     |
| `chat-convert-to-source`        | 会话→来源       | `POST .../convert-to-source`                                            | active         | 待盘点                                                     |
| `chat-convert-to-output`        | 会话→Output     | `POST .../convert-to-output`                                            | active         | 待盘点                                                     |
| `chat-citations`                | 引用            | `GET /v2/citations/:messageId`, `GET .../citations/context`             | active         | 待盘点                                                     |
| `chat-typing-indicator`         | 生成中指示      | `POST /v2/qa/stream`                                                    | active         | 待盘点                                                     |
| `sources-panel`                 | 来源面板        | `GET /v2/notebooks/:nid/sources`                                        | active         | 待盘点                                                     |
| `source-upload`                 | 上传            | `POST /sources/upload`                                                  | active         | 待盘点                                                     |
| `source-add-from-url`           | URL 添加        | `POST .../sources/from-url`                                             | active         | 待盘点                                                     |
| `source-web-search-fast`        | 快速搜索        | `POST .../sources/search`                                               | active         | 待盘点                                                     |
| `source-web-search-deep-toggle` | 深度搜索        | `POST .../sources/search`, `POST /v2/research`                          | active         | 待盘点                                                     |
| `search-results-queue`          | 搜索结果队列    | —                                                                       | active         | 待盘点                                                     |
| `add-search-results-dialog`     | 添加搜索结果    | `POST .../sources/from-url`                                             | active         | 待盘点                                                     |
| `source-select-for-rag`         | RAG 选源        | `POST /v2/qa`                                                           | active         | 待盘点                                                     |
| `source-sort-filter`            | 排序筛选        | `GET .../sources`                                                       | active         | 待盘点                                                     |
| `source-tags-batch`             | 标签批量        | `*/sources/tags*`                                                       | active         | 待盘点                                                     |
| `source-batch-delete`           | 批量删除        | `POST .../batch/delete`                                                 | active         | 待盘点                                                     |
| `source-batch-reembed`          | 批量重嵌        | `POST .../batch/re-embed`                                               | active         | 待盘点                                                     |
| `source-single-reembed`         | 单条重嵌        | `POST /sources/:id/re-embed`                                            | active         | 待盘点                                                     |
| `source-detail-dialog`          | 来源详情        | `GET /sources/:id`, `GET .../chunks`, `POST .../qa`, `GET .../summary`  | active         | 待盘点                                                     |
| `source-connectors-wizard`      | 连接器向导      | `GET/POST /v2/notebooks/:nid/source-connectors*`, `.../bindings/*`      | active         | 待盘点                                                     |
| `extractor-policy-dialog`       | 提取器策略      | `GET/PATCH .../extractors`                                              | active         | 待盘点                                                     |
| `source-jump-highlight`         | 跳转高亮        | `GET /sources/:id/chunks`                                               | active         | 待盘点                                                     |
| `deep-research-start`           | 启动研究        | `POST /v2/research`                                                     | active         | 待盘点                                                     |
| `research-capsule`              | 研究胶囊        | `GET /v2/research`, `POST .../cancel                                    | resume`        | active                                                     | 待盘点 |
| `research-detail-panel`         | 研究详情        | `GET /v2/research/:id`, HITL `POST .../*`, `GET .../stream`             | active         | 待盘点                                                     |
| `research-history`              | 研究历史        | `GET/DELETE /v2/research`                                               | active         | 待盘点                                                     |
| `studio-panel`                  | Studio 面板     | `GET /v2/outputs`                                                       | active         | 待盘点                                                     |
| `studio-outputs-list`           | Output 列表     | `GET /v2/outputs`                                                       | active         | 待盘点                                                     |
| `studio-add-manual-note`        | 手动笔记        | `POST /v2/outputs`                                                      | active         | 待盘点                                                     |
| `studio-generate-tools`         | 生成工具        | `GET /v2/workspace/tools`, `POST /v2/outputs`                           | active         | 待盘点                                                     |
| `studio-tool-config-dialog`     | 工具配置        | `GET /v2/workspace/tools/:id/config`                                    | active         | 待盘点                                                     |
| `model-selector`                | 模型选择        | `GET /v2/models`                                                        | active         | 待盘点                                                     |
| `generation-preference`         | 生成偏好        | `POST /v2/outputs`                                                      | active         | 待盘点                                                     |
| `slides-studio-dialog`          | Slides Studio   | `POST/GET/PATCH /v2/studio/slides*`, stream                             | active         | 待盘点                                                     |
| `studio-output-viewer`          | Output 查看     | `GET /v2/outputs/:id`                                                   | active         | 待盘点                                                     |
| `output-content-renderer`       | 内容渲染        | —                                                                       | active         | 待盘点                                                     |
| `output-export`                 | 导出            | `GET /v2/outputs/:id/export`                                            | active         | 待盘点                                                     |
| `output-delete`                 | 删除            | `DELETE /v2/outputs/:id`                                                | active         | 待盘点                                                     |
| `output-convert-to-source`      | 转来源          | `POST /v2/outputs/:id/convert-to-source`                                | active         | 待盘点                                                     |
| `output-queue-jobs`             | 任务队列        | `POST .../outputs`, slides SSE（**客户端本地队列**；不调 `/v2/tasks*`） | active         | 2026-07-20：旧映射错误；`/v2/tasks*` 为死面（见下）        |
| `output-fallback-retry`         | 降级重试        | `POST /v2/outputs`                                                      | active         | 待盘点                                                     |
| `generic-output-renderer`       | 通用渲染        | `GET /v2/workspace/tools`（非 `/outputs/types`）                        | active         | 2026-07-20：FE 不调 `/outputs/types`                       |
| `output-note-type-paragraph`    | PARAGRAPH       | `POST /v2/outputs`                                                      | active         | Studio 生成路径；`/v2/refine` 为 API-only                  |
| `output-note-type-bullets`      | BULLETS         | `POST /v2/outputs`                                                      | active         | Studio 生成路径；`/v2/refine` 为 API-only                  |
| `output-note-type-structured`   | STRUCTURED      | `POST /v2/outputs`                                                      | active         | Studio 生成路径；`/v2/refine` 为 API-only                  |
| `output-faq-flashcards`         | FAQ 插件        | `POST /v2/outputs` (FAQ)                                                | active         | 待盘点                                                     |
| `output-guide-checklist`        | GUIDE 插件      | `POST /v2/outputs` (GUIDE)                                              | active         | 待盘点                                                     |
| `output-timeline`               | TIMELINE 插件   | `POST /v2/outputs` (TIMELINE)                                           | active         | 待盘点                                                     |
| `output-mindmap`                | MINDMAP 插件    | `POST /v2/outputs` (MINDMAP)                                            | active         | 待盘点                                                     |
| `output-quiz`                   | QUIZ 插件       | `POST /v2/outputs` (QUIZ)                                               | active         | 待盘点                                                     |
| `output-briefing-report`        | BRIEFING 插件   | `POST /v2/outputs` (BRIEFING)                                           | active         | 待盘点                                                     |
| `output-slides-inline`          | SLIDES 内联     | `POST /v2/outputs` (SLIDES)                                             | active         | 待盘点                                                     |
| `output-official-bundles`       | 官方 Bundle     | `GET /v2/workspace/tools`                                               | active         | 待盘点                                                     |
| `system-config-dialog`          | 系统配置        | `GET/POST/PATCH/DELETE /v2/prompt-presets`                              | active         | 待盘点                                                     |
| `diagnostics-dialog`            | 诊断            | `GET /health`, `GET /health/dependencies`                               | active         | 待盘点                                                     |
| `command-palette`               | 命令面板        | 多路由聚合                                                              | active         | 待盘点                                                     |
| `refine-templates-data`         | Refine 模板数据 | —                                                                       | orphan         | dead path；待 prune                                        |
| `dev-payload-warnings`          | DEV 警告        | —                                                                       | orphan         | 待盘点                                                     |
| —                               | —               | `GET/POST /v2/refine*`                                                  | dead-candidate | 无 FE；Studio refine 走 outputs；可整域移除（需缩 spec）   |
| —                               | —               | `GET /v2/qa/presets`                                                    | dead-candidate | 无 FE；内建预设经 `/commands` + QA `/prompt:` 仍活         |
| —                               | —               | `GET /v2/outputs/types`                                                 | dead-candidate | 无 FE；由 `workspace/tools` 替代                           |
| —                               | —               | `GET .../citations/context`                                             | dead-candidate | 无 FE（证据 UI 已删）；仅测/BDD/spec                       |
| —                               | —               | `POST /v2/qa` (非流式)                                                  | api-only       | FE `useChat` 有非流式分支；默认流式                        |
| —                               | —               | `GET /sources/parsers`                                                  | api-only       | 待盘点                                                     |
| —                               | —               | `GET/POST /v2/tasks*`（含 cancel）                                      | dead-candidate | 无 FE；非创建 CRUD；仅 refine enqueue+同请求 wait；可移除  |
| —                               | —               | `GET /v2/models/:modelId`, `GET /v2/models/providers`                   | api-only       | 待盘点                                                     |
| —                               | —               | `GET/POST /v2/eval/*` (8 endpoints)                                     | dead-candidate | 无 UI/CI/CLI；Golden+Judge harness；决策：可移除（缩 r11） |
| —                               | —               | `GET/POST /v2/strategies`, `.../notebooks/:nid/strategies`              | dead-candidate | 无 FE；保留内部 `ragRegistry`                              |
| —                               | —               | `GET /openapi.json`, `GET /asyncapi.json`                               | api-only       | 待盘点                                                     |
| —                               | —               | `POST /v2/source-connector-bindings/:id/sync`                           | api-only       | 待盘点                                                     |
| —                               | —               | `PATCH .../sessions/:sid` (shared_state)                                | api-only       | 待盘点                                                     |

## Server 端点统计（按域）

| 域                  | 端点数   |
| ------------------- | -------- |
| system              | 6        |
| notebooks           | 5        |
| sessions + messages | 9        |
| qa                  | 4        |
| sources + extras    | 22       |
| source-connectors   | 8        |
| research            | 12       |
| outputs             | 7        |
| studio              | 11       |
| refine              | 3        |
| templates           | 5        |
| prompt-presets      | 4        |
| commands            | 1        |
| citations           | 2        |
| tasks               | 3        |
| models              | 3        |
| workspace           | 2        |
| eval                | 8        |
| rag                 | 3        |
| **合计**            | **~128** |
