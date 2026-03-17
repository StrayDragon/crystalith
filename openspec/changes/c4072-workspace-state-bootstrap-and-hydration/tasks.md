## 1. Projection model

- [ ] 1.1 定义 workspace state projection 的对象覆盖范围
- [ ] 1.2 定义 recent context、summary cache 与局部失效语义
- [ ] 1.3 复核 home/cockpit/collection home 消费同一份 projection

## 2. Bootstrap contract

- [ ] 2.1 定义 workspace bootstrap endpoint 的最小响应形状
- [ ] 2.2 定义 bootstrap 只覆盖首屏 seed 的边界
- [ ] 2.3 定义 bootstrap 与 field sets/pagination 的关系

## 3. Hydration rules

- [ ] 3.1 定义 bootstrap hydrate 到 SWR 与 state slices 的规则
- [ ] 3.2 定义 active panel 渐进加载与后续 refetch 边界
- [ ] 3.3 复核错误不会把 bootstrap 变成新的黑箱

## 4. Frontend client layer（自 c4073 并入）

- [ ] 4.1 定义稳定 API wrapper 与 typed error（含 correlation_id）契约
- [ ] 4.2 定义 SWR key registry、精确失效与 domain hooks 采用边界
- [ ] 4.3 定义 SSE stream client：envelope、多路复用、合并/节流与资源防护
- [ ] 4.4 定义请求取消、stale inflight 剪枝与 SSE 生命周期对齐
- [ ] 4.5 定义 cache snapshot / fast resume：白名单、schema 版本绑定与 revalidate

## 5. Verification

- [ ] 5.1 复核 projection/bootstrap 与 client cache/stream 没有重复定义 hydration 语义
- [ ] 5.2 复核 bootstrap seed 与 SWR key 空间、失效图一致
- [ ] 5.3 运行 `openspec validate c4072-workspace-state-bootstrap-and-hydration`
