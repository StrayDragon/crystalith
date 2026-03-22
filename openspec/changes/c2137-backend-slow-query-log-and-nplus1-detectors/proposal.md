## Why

后端性能退化最常见的来源其实很朴素：多了一次查询、少了一个索引、某个列表接口从“几十条”变成“几千条”。这些问题在个人环境里尤其隐蔽——数据量慢慢涨，直到某天突然发现“怎么每次打开都要等半天”。

我们已经有迁移/约束与 drift 方向（`c31`、`c2022`），但这条线更偏结构正确性。这里想补的是运行时可见性：让每个请求的查询成本变得可测、可追、可回归。

## What Changes

- 增加 request-scoped DB query stats（默认 dev/local 开启，可配置）：
  - query_count / total_db_time_ms
  - top slow queries（脱敏后）与疑似 N+1 片段
  - 关联 `correlation_id`，让前端/诊断包能直接指向一次动作
- N+1 detectors（轻量启发式）：
  - 同一请求内出现大量形状相似的查询（同 SQL 模板、不同参数）则标记为 suspected N+1
  - v1 不追求完全准确，先把“明显的坑”抓住
- 输出与门禁：
  - 在 diagnostics workbench（`c30`）展示聚合摘要
  - 在关键 endpoint 的回归场景里允许加预算阈值（对齐 `quality-and-regression` 的“先 warn 后 gate”策略）

## Capabilities

### New Capabilities

- `backend-slow-query-log-and-nplus1-detectors`: 查询统计字段、N+1 识别与输出边界。

### Modified Capabilities

- `structured-logging-schema-redaction-and-error-sampling`（`c2019`）：确保 SQL/参数/路径被正确脱敏或摘要化。
- `request-context-and-correlation-ids`（`c2002`）：把 query stats 和一次动作串起来。
- `data-and-storage`: 建议为热点表补齐“该快到什么程度”的经验阈值（不写死）。
- `dev-diagnostics-workbench`（`c30`）：新增“慢查询/疑似 N+1”视图。

## Impact

- Backend：能更早发现慢查询与 N+1；也能让“性能优化”从个人经验变成共享事实。
- Risk：如果把统计开关默认开到生产会有开销；v1 明确只在 dev/local 或显式开启的 profile 下启用。

```mermaid
flowchart LR
  REQ[HTTP request] --> DB[SQLAlchemy/DB]
  DB --> STATS[Query stats collector]
  STATS --> LOG[Structured logs (redacted)]
  STATS --> DIAG[Diagnostics UI / export pack]
```
