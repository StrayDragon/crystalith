## Why

当前 `/prompt:*` 指令仅对内置 preset 生效，且在 UI 中几乎不可发现；新增/调整 preset 需要改代码与发版。我们希望：

- 前端能从后端获取结构化的“指令/命令”定义（支持未来扩展到更多 `/*` 命令族）
- Chat 输入支持好用的自动补全（Tab 补全 + 描述展示）
- 提供“系统配置”入口，让用户能 CRUD 自定义 `/prompt:*` preset（触发词/触发内容/描述），无需重新部署前端

## What Changes

- Backend:
  - 新增 `prompt_presets` 持久化表，用于存储自定义 preset（全局作用域）。
  - 新增命令 registry 端点：`GET /v1/commands`，返回结构化命令列表（初期仅包含 prompt preset，未来可扩展）。
  - 新增 preset CRUD 端点：`GET/POST/PATCH/DELETE /v1/prompt-presets`，同时返回内置 + 自定义；内置只读，自定义可编辑/禁用/删除。
  - QA `/prompt:` 指令解析扩展为：可解析并应用自定义 preset；自定义 preset 仅覆盖 system prompt；`stats` 仍保持内置的结构化输出与 UI envelope 行为。
- Frontend:
  - Chat 输入框在聚焦/输入时请求 `GET /v1/commands` 并展示自动补全菜单（支持 ↑↓ 选择、Tab 接受、Enter 选择、Esc 关闭）。
  - Avatar 下拉菜单新增“系统配置”，在弹窗中对自定义 `/prompt:*` preset 执行 CRUD，并即时刷新补全列表。
- Tooling/Docs:
  - OpenAPI 更新并同步前端 client（`pnpm run api:sync`）。
  - 增加针对命令 registry / preset CRUD / QA directive 行为的测试与手动验证步骤。

## Capabilities

### New Capabilities

- `workspace-command-registry`: 提供稳定的命令发现 API（`/v1/commands`）与可扩展的命令 schema，用于驱动前端补全。

### Modified Capabilities

- `chat-prompt-presets`: 在保持 `/prompt:` 指令语法不变的前提下，支持自定义 preset 的注册/禁用/解析与 system prompt 覆盖语义。
- `workspace-api-contract`: 增加 `/v1/commands` 与 `/v1/prompt-presets` 的稳定契约、错误语义与最小字段集。
- `workspace-ui-panels`: Chat 输入新增命令自动补全交互；新增“系统配置”入口用于管理 prompt presets。

## Impact

- 新增 DB 表与迁移，需要在本地/部署环境执行迁移。
- 新增 API 端点，前端会产生额外请求；需控制性能/缓存策略（初期可无缓存，或后续添加极短 TTL/ETag）。
- 自定义 system prompt 由用户输入，需限制长度并在 UI 中提示风险（本变更不做多租户/权限隔离）。
