## Context

系统已经具备长链路特征：一次动作会跨 HTTP、SSE、后台任务、检索、模型调用与缓存。`c2009` 解决“链路可串联”，`c2020` 解决“串联后的信息如何被人消费”。合并后的目标是把二者收口成一个诊断基础设施：底层字段稳定，上层入口低摩擦。

## Goals

- 统一 `correlation_id`、结构化日志、最小指标、可选 tracing 与健康检查
- 提供 diagnostics workbench，收口系统状态与单次动作线索
- 提供默认脱敏、可分享、可 diff 的 diagnostic bundle / export pack
- 标准化 run timings breakdown 与 perf timeline
- 提供 runtime memory budget 与 leak detection 的最小契约

## Non-Goals

- 不在本 change 内部署完整观测平台或告警系统
- 不把 diagnostics 默认暴露给所有普通用户
- 不要求一次性做完所有高级性能分析能力

## Decisions

- `correlation_id` 是用户动作级的主关联键；`trace_id/span_id` 为可选扩展
- diagnostics surface 分为 dev 与 product 两层，避免过度暴露内部细节
- export pack 与后端 diagnostic bundle 共享红线：默认脱敏、限制体积、禁止 secret 明文与大段正文
- timings 与 memory 输出优先服务“定位问题”和“给出恢复动作”，不是做纯展示型面板

## Architecture Slices

1. **Observability baseline**
   - middleware 负责注入 `correlation_id`
   - logging / metrics / tracing 统一字段和开关
   - `/health`、`/ready`、`/metrics` 提供最低运行基线

2. **Diagnostics aggregation**
   - 聚合 effective config、optional services、queue、cache、plugin health、run summaries
   - 提供 bundle/export pack 接口与 redaction

3. **User-facing diagnostics surface**
   - DiagnosticsDialog / diagnostics page 消费 aggregation API
   - timings timeline、memory trend、export pack、copy correlation id 作为固定动作

## Risks / Trade-offs

- 信号越多，越容易把 diagnostics 做成“另一个日志海” → 必须分层呈现，并为每类信号绑定恢复动作
- 导出包越完整，越容易碰到隐私与体积问题 → 先做稳定摘要与红线，再逐步扩展附件
- tracing / metrics 会增加运行成本 → 默认关闭 tracing，并让 metrics 与 diagnostics 能按 profile 调整

## Acceptance Criteria

- [ ] `correlation_id` 能在 HTTP、SSE、后台任务、日志、bundle 与前端提示中贯通
- [ ] `/health` 与 `/ready` 稳定可用，`/metrics` 可按开关暴露
- [ ] diagnostics workbench 能查看关键系统状态与最近 run 摘要
- [ ] export pack 默认脱敏且能与后端 bundle 对齐
- [ ] timings timeline 能显示主要阶段与等待时间
- [ ] memory budget / leak detector 至少能给出趋势摘要与恢复动作
