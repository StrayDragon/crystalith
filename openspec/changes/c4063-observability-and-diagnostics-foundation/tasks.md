## 1. Traceability baseline

- [ ] 1.1 落地 `correlation_id` 的生成、透传与复制路径
- [ ] 1.2 统一 HTTP、SSE、后台任务与上游调用中的关联字段
- [ ] 1.3 复核前端错误提示和 diagnostics UI 能消费同一个关联键

## 2. Structured logging, metrics, tracing

- [ ] 2.1 统一结构化日志字段、脱敏与采样策略
- [ ] 2.2 定义最小指标集合与 `/metrics` 开关
- [ ] 2.3 定义可选 tracing 的启用条件、child span 边界与导出约束

## 3. Runtime baseline endpoints

- [ ] 3.1 实现 `/health` 与 `/ready` 的最小契约
- [ ] 3.2 明确不同 profile 下 diagnostics / tracing / metrics 的默认值
- [ ] 3.3 复核自托管文档能找到最小排障入口

## 4. Diagnostics aggregation and export

- [ ] 4.1 定义 diagnostics aggregation API：config、services、queue、cache、plugin health、recent runs
- [ ] 4.2 定义 diagnostic bundle / export pack 的目录结构、字段对齐与 redaction 红线
- [ ] 4.3 复核 bundle 与 export pack 都不包含 secret 明文和大段正文

## 5. Timings and memory diagnostics

- [ ] 5.1 定义 run timings breakdown 的阶段字段与等待时间语义
- [ ] 5.2 定义 perf timeline 的最小查看交互与复制路径
- [ ] 5.3 定义 runtime memory budgets、trend signals 与恢复动作

## 6. Diagnostics UX

- [ ] 6.1 明确 dev diagnostics 与 product diagnostics 的入口和信息分层
- [ ] 6.2 明确 DiagnosticsDialog / diagnostics page 的最小能力集合
- [ ] 6.3 明确导出、复制 correlation id、查看 timings、查看 memory 的固定入口

## 7. Maintenance previews（自 c4068 并入）

- [ ] 7.1 定义 footprint breakdown、heavy objects 与 retention preview 语义
- [ ] 7.2 定义 cache epoch inspection 与 invalidation preview 语义
- [ ] 7.3 定义 generated asset cleanup 与 stale bundle detection 边界

## 8. Startup self-test and health（自 c4068 并入）

- [ ] 8.1 定义 startup self-test 的最小检查集与输出格式
- [ ] 8.2 定义 operational baseline checklist 与 profile 裁剪规则
- [ ] 8.3 定义 workspace health score 与 decay signals 的轻量边界

## 9. Drift and upgrade audits（自 c4068 并入）

- [ ] 9.1 定义 local environment drift audit 的检查维度
- [ ] 9.2 定义 dependency audit、upgrade risk note 与 migration hint 输出
- [ ] 9.3 复核风险说明能回接 repair playbook

## 10. Repair loop（自 c4068 并入）

- [ ] 10.1 定义 repair wizard、safe fix batch 与回滚边界
- [ ] 10.2 定义 local store integrity checks 与 healing suggestions
- [ ] 10.3 复核 maintenance 与 repair 不会默认做粗暴重置

## 11. Verification

- [ ] 11.1 复核 observability/diagnostics 与 maintenance/repair 没有重复或冲突定义
- [ ] 11.2 复核 diagnostics bundle 与 maintenance preview 字段、自救动作入口对齐
- [ ] 11.3 运行 `openspec validate c4063-observability-and-diagnostics-foundation`
