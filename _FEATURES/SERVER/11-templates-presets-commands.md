# 模板、Prompt 预设与命令

---

## 模板（Templates）

### `templates-list`

- **Domain:** templates
- **Route:** `GET /v2/templates`
- **说明:** 列出所有模板
- **用户可见:** Yes
- **代码:** `apps/server/src/features/templates/router.ts`

> NOTE: 待盘点

---

### `templates-create`

- **Domain:** templates
- **Route:** `POST /v2/templates`
- **说明:** 创建自定义模板
- **用户可见:** Yes
- **代码:** `apps/server/src/features/templates/router.ts`

> NOTE: 待盘点

---

### `templates-get`

- **Domain:** templates
- **Route:** `GET /v2/templates/:id`
- **说明:** 获取模板详情
- **用户可见:** Yes
- **代码:** `apps/server/src/features/templates/router.ts`

> NOTE: 待盘点

---

### `templates-patch`

- **Domain:** templates
- **Route:** `PATCH /v2/templates/:id`
- **说明:** 更新模板（内置模板不可改 → 409）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/templates/router.ts`

> NOTE: 待盘点

---

### `templates-delete`

- **Domain:** templates
- **Route:** `DELETE /v2/templates/:id`
- **说明:** 删除模板（内置不可删 → 409）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/templates/router.ts`

> NOTE: 待盘点

---

## Prompt 预设（Prompt Presets）

### `prompt-presets-list`

- **Domain:** prompt-presets
- **Route:** `GET /v2/prompt-presets`
- **说明:** 列出自定义 prompt 预设
- **用户可见:** Yes（系统配置对话框）
- **代码:** `apps/server/src/features/prompt-presets/router.ts`

> NOTE: 待盘点

---

### `prompt-presets-create`

- **Domain:** prompt-presets
- **Route:** `POST /v2/prompt-presets`
- **说明:** 创建预设（trigger 唯一性校验）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/prompt-presets/router.ts`

> NOTE: 待盘点

---

### `prompt-presets-patch`

- **Domain:** prompt-presets
- **Route:** `PATCH /v2/prompt-presets/:id`
- **说明:** 更新预设
- **用户可见:** Yes
- **代码:** `apps/server/src/features/prompt-presets/router.ts`

> NOTE: 待盘点

---

### `prompt-presets-delete`

- **Domain:** prompt-presets
- **Route:** `DELETE /v2/prompt-presets/:id`
- **说明:** 删除预设
- **用户可见:** Yes
- **代码:** `apps/server/src/features/prompt-presets/router.ts`

> NOTE: 待盘点

---

## 命令（Commands）

### `commands-list`

- **Domain:** commands
- **Route:** `GET /v2/commands`
- **说明:** 合并内置 QA preset + DB 自定义 preset 为斜杠命令列表
- **用户可见:** Yes（ChatPanel `/` 菜单）
- **代码:** `apps/server/src/features/commands/router.ts`

> NOTE: 待盘点
