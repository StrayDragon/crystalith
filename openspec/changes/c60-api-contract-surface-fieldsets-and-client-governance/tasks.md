## 1. API shape and list tiers

- [ ] 1.1 定义 `summary` / `list item` / `detail` / `action result` 的边界
- [ ] 1.2 定义 cursor pagination、sort、filters 与统一 `meta` 形状
- [ ] 1.3 定义 `bootstrap|list|detail` fieldset presets 与适用范围

## 2. Error and OpenAPI governance

- [ ] 2.1 定义统一 `ErrorResponse`、error code registry 与 SSE error event
- [ ] 2.2 定义 route taxonomy、tags、operationId 与 non-2xx coverage gate
- [ ] 2.3 定义 OpenAPI export/check 与 generated client drift gate 的职责边界

## 3. Response budget rollout

- [ ] 3.1 定义 read-heavy endpoints 的 response size budget 范围
- [ ] 3.2 定义 bytes signal 与 warn → gate 的回归路径
- [ ] 3.3 复核 list/fieldset/budget 不会与 bootstrap 和 cache hydration 语义冲突

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 5 个旧 change 的核心约束
- [ ] 4.2 复核没有保留互相冲突的兼容承诺
- [ ] 4.3 运行 `openspec validate c4074-api-contract-surface-fieldsets-and-client-governance`
