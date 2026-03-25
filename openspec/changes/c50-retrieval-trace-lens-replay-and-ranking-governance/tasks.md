## 1. Trace and lens substrate

- [ ] 1.1 定义 query lens、seed catalog 与 rewrite pipeline 的记录边界
- [ ] 1.2 定义 retrieval trace、snapshot_id 与 replay 输入输出语义
- [ ] 1.3 定义 trace 与 debug workbench / compare view 的共用字段

## 2. Ranking and determinism

- [ ] 2.1 定义 vector / lexical / hybrid modes、fusion 与 fallback reason codes
- [ ] 2.2 定义 rerank feature contract、top reasons 与 dropped reasons explain
- [ ] 2.3 定义 `similarity_score`、stable ordering 与 determinism notes

## 3. Proof packs and gates

- [ ] 3.1 定义 proof pack 的最小内容、脱敏边界与 replay 入口
- [ ] 3.2 定义 retrieval/citation regression suite 与 diff report
- [ ] 3.3 复核 replay / proof pack / determinism / explain 语义互相支撑

## 4. Cache policy and telemetry（自 c4080 并入）

- [ ] 4.1 定义 assembly / embedding / vector cache 的 key、TTL 与 admission 规则
- [ ] 4.2 定义 `cache_status`、bypass_reason、staleness_reason 与 benefit metrics
- [ ] 4.3 定义 singleflight、soft TTL 与 jitter 的边界

## 5. QoS and warmup（自 c4080 并入）

- [ ] 5.1 定义 interactive / background / maintenance lanes 与 budgets
- [ ] 5.2 定义 warmup targets、triggers 与 background lane 执行规则
- [ ] 5.3 定义 degraded mode、Retry-After 与 lane 调度的衔接方式

## 6. Cold-path governance（自 c4080 并入）

- [ ] 6.1 定义 cache coverage map 与 cold-path detection 的输出语义
- [ ] 6.2 定义如何将 warmup 收益、bypass 原因与 cold path 关联起来
- [ ] 6.3 复核 cache policy / QoS / warmup / cold-path 语义互相支撑

## 7. Vector store contract and parity（自 c2154 并入）

- [ ] 7.1 定义 VectorStore 最小契约（upsert/delete/query、metadata、capability flags、模型维度切换）
- [ ] 7.2 定义 provider parity suite 与「声明差异」报告格式
- [ ] 7.3 定义 bench harness、profile parity 报告与默认调参建议的产出边界
- [ ] 7.4 定义 embedded vs remote 判定与诊断暴露；与 `c2153` readiness 叙事对齐

## 8. ANN tuning and index generation（自 c2154 并入）

- [ ] 8.1 定义 ANN tuning contract、provider 不支持声明与高风险参数门禁路径
- [ ] 8.2 定义 `index_generation_id`、staging→active 原子切换与可解释切换输出
- [ ] 8.3 定义 atomic read snapshot 与 replay 同代/近似回放标记；与 assembly cache key 规则对齐

## 9. Verification

- [ ] 9.1 复核 merged proposal 已吸收 trace/ranking、cache/QoS 与原 c2154 向量契约/代际/ANN 的关键约束且无冲突语义
- [ ] 9.2 复核 query lens、rerank explain、proof pack、cache/lane 与 vector/generation 解释没有重复定义不同真相
- [ ] 9.3 复核「跨层公共验收口径」六条在 delta spec 或设计笔记中有对应落点
- [ ] 9.4 运行 `openspec validate c4079-retrieval-trace-lens-replay-and-ranking-governance`
