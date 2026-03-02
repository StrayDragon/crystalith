## Context

- 现有 `/prompt:<preset> <query>` 指令由后端解析并选择 preset 策略；当前仅内置 `stats`，且前端没有发现/补全能力。
- 用户希望通过 UI 配置自定义 preset，并让前端通过结构化 API 获取可用命令列表（未来可扩展到更多 `/*` 命令族）。

## Goals / Non-Goals

**Goals:**

- 提供一个面向前端的命令 registry（`GET /v1/commands`），返回结构化命令定义（`kind/source/trigger/description/enabled/meta`）。
- 支持自定义 prompt presets 的 CRUD（触发词、描述、system prompt、启用开关），并可被 QA `/prompt:` 指令解析使用。
- 前端提供易用的自动补全：Tab 一键补全，展示描述，键盘可导航，不影响现有 Enter 发送语义。
- 提供“系统配置”入口用于管理自定义 presets，并在变更后即时刷新补全。

**Non-Goals:**

- 不实现 per-user / per-notebook 的 presets（本次为全局）。
- 不实现复杂的多级命令解析/执行框架（仅提供发现与补全；实际行为仍由后端 QA 解释）。
- 不让自定义 preset 复用 `stats` 的结构化输出协议（`stats` 保持内置专用）。
- 不在本次引入持久缓存层（可选后续加极短缓存/ETag）。

## Decisions

1. **Command registry schema**
   - `/v1/commands` 返回 `CommandRead[]`：
     - `kind`: `"prompt_preset"`（future-proof）
     - `trigger`: UI 可直接插入输入框的字符串（例如 `/prompt:stats`）
     - `id`: 稳定 id（初期等于 preset trigger）
     - `description`, `enabled`, `source`（`builtin|custom`）, `meta?`
   - 返回内置 + 自定义；按 `trigger` 排序；包含 disabled 项，让 UI 能显示禁用状态。

2. **Prompt preset data model**
   - DB 表 `prompt_presets`: `trigger`（unique, lowercased）, `description?`, `system_prompt`, `enabled`, timestamps.
   - 触发词规范化：`[a-z0-9_-]{1,32}`，入库前统一为小写并 trim。
   - 内置 preset 只读；自定义 preset 不能与内置冲突；自定义之间也不能冲突（409）。

3. **QA integration**
   - 仍然解析 in-band `/prompt:` 指令；当解析出 preset：
     - 若 preset 不存在 -> 400，并返回稳定用法提示与可用 preset 列表（应包含内置 + 自定义）。
     - 若 preset disabled -> 400。
     - 解析出的 `query` 作为实际 QA question；preset 的 system prompt 覆盖 pipeline 的 system message。
   - `stats` 保持内置专用：只有 `builtin stats` 走 JSON 验证/回退与 UI envelope；其它 presets（包括自定义）只作为 system prompt 覆盖。

4. **Frontend autocomplete UX**
   - 输入框聚焦时拉取 `/v1/commands`（使用去抖与去重）；也可在打开补全菜单时再次 revalidate 以满足“每次前端都请求”的期望。
   - 补全菜单基于当前 token（以 `/` 开头）过滤；显示 `trigger` + `description`，disabled 置灰并阻止选择。
   - 键盘语义：
     - Menu open: ↑↓ 选择；Tab/Enter 接受选中项；Esc 关闭
     - Menu closed: Tab/Enter 保持原行为（Enter 发送）
   - 使用现有 layer/portal 体系（不硬编码 z-index）。

5. **System config UI**
   - Avatar menu 增加“系统配置”入口，打开 modal。
   - Modal 内部提供 prompt preset CRUD：
     - 列表展示 builtin+custom；builtin 只读并提供“复制为自定义”。
     - custom 支持 enabled toggle / edit / delete。
   - 任何 mutation 后：刷新 preset 列表与 `/v1/commands` 缓存（mutate）。

## Risks / Trade-offs

- 频繁拉取 `/v1/commands` 可能增加请求量 → 前端 dedupe + 可选后端极短 Cache-Control/ETag。
- 自定义 system prompt 可能导致不稳定输出/安全风险 → 限制长度、UI 提示、后端仅在本地/受信环境使用。
- 全局 presets 在多用户场景可能互相影响 → 后续如需多租户/权限，再引入 user scope 与 RBAC。
- 与现有规范冲突（`chat-prompt-presets` 当前声明不支持自定义）→ 通过本变更更新 specs。
