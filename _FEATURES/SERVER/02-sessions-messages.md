# 会话与消息（Sessions & Messages）

---

### `sessions-list`

- **Domain:** sessions
- **Route:** `GET /v2/notebooks/:nid/sessions`
- **说明:** 分页列出笔记本下会话
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sessions/router.ts`

> NOTE: 待盘点

---

### `sessions-get`

- **Domain:** sessions
- **Route:** `GET /v2/notebooks/:nid/sessions/:sid`
- **说明:** 获取单个会话（含 shared_state）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sessions/router.ts`

> NOTE: 待盘点

---

### `sessions-create`

- **Domain:** sessions
- **Route:** `POST /v2/notebooks/:nid/sessions`
- **说明:** 创建会话
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sessions/router.ts`

> NOTE: 待盘点

---

### `sessions-patch`

- **Domain:** sessions
- **Route:** `PATCH /v2/notebooks/:nid/sessions/:sid`
- **说明:** 更新标题 / shared_state（乐观锁 revision）
- **用户可见:** Partial
- **代码:** `apps/server/src/features/sessions/router.ts`

> NOTE: 待盘点

---

### `sessions-delete`

- **Domain:** sessions
- **Route:** `DELETE /v2/notebooks/:nid/sessions/:sid`
- **说明:** 删除会话（级联消息）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sessions/router.ts`

> NOTE: 待盘点

---

### `sessions-convert-to-source`

- **Domain:** sessions
- **Route:** `POST /v2/notebooks/:nid/sessions/:sid/convert-to-source`
- **说明:** 会话消息 → source（chunk + embed）；可选 `message_ids`
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sessions/router.ts`

> NOTE: 待盘点

---

### `sessions-convert-to-output`

- **Domain:** sessions
- **Route:** `POST /v2/notebooks/:nid/sessions/:sid/convert-to-output`
- **说明:** 会话消息 → Output（paragraph/bullets/structured）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sessions/router.ts`

> NOTE: 待盘点

---

### `messages-list`

- **Domain:** messages
- **Route:** `GET /v2/notebooks/:nid/sessions/:sid/messages`
- **说明:** 分页消息列表（时间升序）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/messages/router.ts`

> NOTE: 待盘点

---

### `messages-create`

- **Domain:** messages
- **Route:** `POST /v2/notebooks/:nid/sessions/:sid/messages`
- **说明:** 创建用户/系统消息
- **用户可见:** Yes
- **代码:** `apps/server/src/features/messages/router.ts`

> NOTE: 待盘点
