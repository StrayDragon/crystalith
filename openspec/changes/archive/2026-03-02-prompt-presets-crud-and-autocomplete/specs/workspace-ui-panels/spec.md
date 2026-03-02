## ADDED Requirements

### Requirement: Chat input provides command autocomplete for /prompt presets
Workspace 的 Chat 输入框 MUST 使用 `GET /v1/commands` 获取命令列表，并在用户输入 `/` 或 `/prompt:` 前缀时提供自动补全 UI。

#### Scenario: Tab accepts the selected suggestion
- **WHEN** 用户打开补全菜单并选中某项命令
- **AND** 用户按下 `Tab`
- **THEN** UI SHALL 将该命令的 `trigger` 插入到输入框中（替换当前 token）

#### Scenario: Disabled commands are not selectable
- **WHEN** 补全列表中某条命令 `enabled=false`
- **THEN** UI SHALL 将其展示为 disabled
- **AND** SHALL 阻止用户通过键盘/鼠标选择并插入该命令

#### Scenario: Autocomplete does not block sending raw text
- **WHEN** 用户输入以 `/prompt:` 开头的文本并发送（无论是否打开补全）
- **THEN** UI SHALL 将该文本按原样发送给后端（不在前端做“非法 preset”拦截）

### Requirement: System config UI allows users to manage prompt presets
Workspace UI MUST 提供“系统配置”入口，并允许用户对 custom `/prompt:*` presets 执行 CRUD（触发词、描述、system prompt、启用状态）。

#### Scenario: Preset CRUD updates autocomplete
- **WHEN** 用户在“系统配置”中创建/更新/删除 custom preset
- **THEN** UI SHALL 刷新 `GET /v1/commands` 的缓存并更新补全列表
