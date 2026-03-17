## 1. Object and readiness substrate

- [ ] 1.1 定义 core domain objects、typed ids 与字段命名契约
- [ ] 1.2 定义 readiness / degraded / blocked / recoverable 状态词汇
- [ ] 1.3 定义对象状态与 next-step semantics 的绑定规则

## 2. Guidance and goals

- [ ] 2.1 定义 first-run activation 与 onboarding progress 语义
- [ ] 2.2 定义 proactive next-best actions 与 context-aware recommendations
- [ ] 2.3 定义 goal briefs、run goal contracts、outcome goals 与 impact tracking 关系

## 3. Gap and follow-up loop

- [ ] 3.1 定义 success checks 与 missed criteria report 的输出语义
- [ ] 3.2 定义 goal-gap explanations 如何触发 follow-up guidance
- [ ] 3.3 复核 first-run / next actions / goals / readiness 语义互相支撑

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 6 个旧 change 的关键约束
- [ ] 4.2 复核没有保留多套平行的状态、目标与建议语义
- [ ] 4.3 运行 `openspec validate c4085-workspace-guidance-goals-and-readiness-substrate`
