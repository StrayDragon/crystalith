## 1. Runtime contract

- [ ] 1.1 定义 `AppState` / deps 的最小 contract 与生命周期责任
- [ ] 1.2 定义 background workers、monitors 与 optional services 的 runtime ownership
- [ ] 1.3 定义 shared upstream client registry 与 `service_key` 语义

## 2. Context, errors, and observability

- [ ] 2.1 定义 `correlation_id` / RequestContext 的传播边界
- [ ] 2.2 定义 structured logging schema、redaction 与 sampling/fingerprint 规则
- [ ] 2.3 定义 `retry_after`、rate limit 与统一错误传播路径

## 3. Lifecycle and rollout

- [ ] 3.1 定义 startup / draining / shutdown 的阶段顺序
- [ ] 3.2 定义 worker、SSE、monitor 和核心资源的关闭顺序
- [ ] 3.3 定义 shutdown observability 与 restart reconciliation 接口边界

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 5 个旧 change 的核心约束
- [ ] 4.2 复核 deps / context / upstream / logging 语义互相衔接无冲突
- [ ] 4.3 运行 `openspec validate c4076-backend-runtime-context-lifecycle-and-upstream-governance`
