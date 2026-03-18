## 1. Event and shared-state contract

- [ ] 1.1 定义统一 SSE envelope、event replay 与错误映射
- [ ] 1.2 定义 UI event receipt、revision、idempotent replay 与 conflict 语义
- [ ] 1.3 定义 shared_state delta、retention 与 compaction 边界

## 2. Journal and drift governance

- [ ] 2.1 定义 mutation journal、debug rewind 与 event/receipt 的衔接方式
- [ ] 2.2 定义 UI contract golden、drift alerts 与 review baseline
- [ ] 2.3 定义 ownership checklist 与 contract failure taxonomy

## 3. Repair loop

- [ ] 3.1 定义 repair playbooks 如何消费 drift、journal 与 golden 结果
- [ ] 3.2 定义工作面契约变更的 review/repair 闭环
- [ ] 3.3 复核 transport / merge / journal / drift / repair 语义互相支撑

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 5 个旧 change 的关键约束
- [ ] 4.2 复核没有保留多套并行 UI contract 真相
- [ ] 4.3 运行 `openspec validate c4083-ui-state-events-drift-and-repair-governance`
