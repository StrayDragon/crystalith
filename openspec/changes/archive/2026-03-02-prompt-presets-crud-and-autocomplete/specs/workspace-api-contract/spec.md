## ADDED Requirements

### Requirement: Commands endpoint is available for autocomplete
系统 MUST 提供 `GET /v1/commands` 端点，供前端获取结构化命令列表以驱动自动补全。

#### Scenario: Commands endpoint returns command list
- **WHEN** 客户端请求 `GET /v1/commands`
- **THEN** 系统 SHALL 返回命令列表

### Requirement: Prompt presets CRUD endpoints are stable
系统 MUST 提供 prompt presets 的 CRUD 端点集合：

- `GET /v1/prompt-presets`：返回 built-in + custom 的 preset 列表
- `POST /v1/prompt-presets`：创建 custom preset 并返回 201
- `PATCH /v1/prompt-presets/{preset_id}`：更新 custom preset 并返回更新后的对象
- `DELETE /v1/prompt-presets/{preset_id}`：删除 custom preset 并返回 204

#### Scenario: List includes built-in and custom
- **WHEN** 客户端请求 `GET /v1/prompt-presets`
- **THEN** 返回列表 SHALL 同时包含 `source="builtin"` 与 `source="custom"` 项（如存在）

#### Scenario: Creating a preset returns 409 on conflicts
- **WHEN** 客户端创建一个 trigger 与 built-in 或已存在 custom 冲突的 preset
- **THEN** 系统 SHALL 返回 409

#### Scenario: Updating/deleting missing preset returns 404
- **WHEN** 客户端更新或删除一个不存在的 `preset_id`
- **THEN** 系统 SHALL 返回 404
