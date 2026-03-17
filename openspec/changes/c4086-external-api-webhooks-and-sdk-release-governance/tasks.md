## 1. External API boundary

- [ ] 1.1 定义 public API scope、token scopes 与稳定对象边界
- [ ] 1.2 定义 webhook events、signing、retry 与 delivery history
- [ ] 1.3 定义 public API 与 internal web client / generated client 的边界

## 2. Drift governance

- [ ] 2.1 定义 schema drift、generator drift、version drift 与 submodule drift 分类
- [ ] 2.2 定义 OpenAPI/client/sdk drift watch 与 gate 输出
- [ ] 2.3 定义 ErrorResponse 与 webhook/public API versioning 的契约一致性要求

## 3. Release playbook

- [ ] 3.1 定义 SDK generation / preflight / release steps
- [ ] 3.2 定义 breaking changes 的版本与迁移说明要求
- [ ] 3.3 复核 developer API / webhooks / SDK gates 语义互相支撑

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 2 个旧 change 的关键约束
- [ ] 4.2 复核没有留下两套外部契约边界
- [ ] 4.3 运行 `openspec validate c4086-external-api-webhooks-and-sdk-release-governance`
