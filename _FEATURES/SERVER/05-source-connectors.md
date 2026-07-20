# 来源连接器（Source Connectors）

文件系统等外部来源同步。

---

### `source-connectors-list`

- **Domain:** source-connectors
- **Route:** `GET /v2/notebooks/:nid/source-connectors`
- **说明:** 列出内置连接器及诊断信息
- **用户可见:** Yes
- **代码:** `apps/server/src/features/source-connectors/router.ts`、`connectors.ts`

> NOTE: 待盘点

---

### `source-connectors-bind`

- **Domain:** source-connectors
- **Route:** `POST /v2/notebooks/:nid/source-connectors/:connectorId/bindings`
- **说明:** 创建连接器绑定（校验 connection_config schema）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/source-connectors/router.ts`

> NOTE: 待盘点

---

### `source-connectors-snapshot`

- **Domain:** source-connectors
- **Route:** `POST /v2/notebooks/:nid/source-connector-bindings/:bindingId/snapshot`
- **说明:** 枚举连接器目录快照
- **用户可见:** Yes
- **代码:** `apps/server/src/features/source-connectors/router.ts`、`scanner.ts`

> NOTE: 待盘点

---

### `source-connectors-sync-check`

- **Domain:** source-connectors
- **Route:** `POST /v2/notebooks/:nid/source-connector-bindings/:bindingId/sync-check`
- **说明:** 对比快照与已导入来源，生成 diff
- **用户可见:** Yes
- **代码:** `apps/server/src/features/source-connectors/router.ts`、`sync.ts`

> NOTE: 待盘点

---

### `source-connectors-sync-check-apply`

- **Domain:** source-connectors
- **Route:** `POST /v2/notebooks/:nid/source-connector-bindings/:bindingId/sync-check/apply`
- **说明:** 应用 sync-check 结果（需 sync_check_id）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/source-connectors/router.ts`、`sync.ts`

> NOTE: 待盘点

---

### `source-connectors-import-scope`

- **Domain:** source-connectors
- **Route:** `POST /v2/notebooks/:nid/source-connector-bindings/:bindingId/import-scope`
- **说明:** 按选定目录/文件范围导入
- **用户可见:** Yes
- **代码:** `apps/server/src/features/source-connectors/router.ts`

> NOTE: 待盘点

---

### `source-connectors-sync`

- **Domain:** source-connectors
- **Route:** `POST /v2/source-connector-bindings/:id/sync`
- **说明:** 按 binding id 触发同步检查（无 notebook 前缀）
- **用户可见:** Partial
- **代码:** `apps/server/src/features/source-connectors/router.ts`

> NOTE: 待盘点

---

### `source-connectors-delete-binding`

- **Domain:** source-connectors
- **Route:** `DELETE /v2/source-connector-bindings/:id`
- **说明:** 删除连接器绑定
- **用户可见:** No（对话框有 bind/snapshot/sync，**无解绑按钮**）
- **代码:** `apps/server/src/features/source-connectors/router.ts`

> NOTE: 保留 API + 补 UI — 活功能缺口，不是死路由
