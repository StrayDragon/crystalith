## 1. Run object and API contract

- [ ] 1.1 定义 run 对象字段、状态机与 idempotent start/cancel/query/stream 语义
- [ ] 1.2 定义用户可见状态与内部阶段的映射
- [ ] 1.3 复核 run 与 task、session、output 的绑定边界

## 2. Durability and restart reconciliation

- [ ] 2.1 定义 worker lease、heartbeat 与 stuck detection 字段
- [ ] 2.2 定义 DB claim queue、attempt、retry policy 与 restart reconciliation
- [ ] 2.3 复核 lease 过期、worker 丢失与 requeue/resume/orphan cleanup 的解释语义

## 3. Cancellation and recovery

- [ ] 3.1 明确哪些 run 能安全 cancel，哪些只能 request stop
- [ ] 3.2 定义 resume、requeue、orphan cleanup 的边界与可执行动作
- [ ] 3.3 复核异常中断不会被误标为用户主动取消

## 4. Stage checkpoints and approval gates

- [ ] 4.1 定义 run stages、checkpoint 边界与 continue 条件
- [ ] 4.2 定义 approval gate 的自动通过与手动拦截模式
- [ ] 4.3 定义 gate 中断态如何进入 restart reconciliation 与 resume

## 5. Dry run and simulation

- [ ] 5.1 定义 run plan dry run 的步骤、风险、高成本阶段与输入掉落输出
- [ ] 5.2 定义 dry run 如何回接模板调整、补来源与 stage preview
- [ ] 5.3 复核 dry run 不被误当成真实执行

## 6. Verification

- [ ] 6.1 复核 merged proposal 没有重复定义 lifecycle/durability/gates 语义
- [ ] 6.2 复核旧 change 的关键信息都已被新 change 收口
- [ ] 6.3 运行 `openspec validate c4067-run-lifecycle-durability-and-stage-gates`
