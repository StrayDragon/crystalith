## Context

当前来源管理能力覆盖排序/过滤/epoch 缓存、删除、re-embed、tag CRUD 与绑定，但缺少面向真实使用的“失败诊断与可恢复性”和“规模化管理”（批量操作、去重、可解释的错误语义）。

后端已具备统一错误信封与可选服务探测机制，但 Sources 的失败态仍需要更结构化的记录与暴露，才能让 UI 给出可操作建议。

## Goals / Non-Goals

**Goals:**
- 为来源失败态提供稳定、结构化的诊断信息（错误码 + 人类可读信息 + 恢复建议）。
- 引入可选去重策略，减少重复导入造成的噪声与成本，并保持用户可控。
- 让批量管理端点在幂等性、epoch 失效与失败回显上可预测。

**Non-Goals:**
- 不在本变更中重做上传/URL 抓取/解析算法本身。
- 不引入复杂的“导入历史审计/多次尝试记录”表结构（可作为后续迭代）。

## Decisions

- **失败诊断字段落地**：在 Source 层记录最小字段集（error_code/error_message/recovery_hint/last_error_at），并在 list/get 响应中可选返回。
- **错误码体系**：复用后端统一错误信封的理念，为 ingestion 管道定义稳定错误码集合（例如：PARSER_FAILED/URL_FETCH_BLOCKED/EXTRACTOR_TIMEOUT/OPTIONAL_SERVICE_UNAVAILABLE）。
- **去重键策略（可选）**：
  - upload：基于文件内容 hash 或规范化文本 hash 作为 dedup_key（避免仅 filename）。
  - url：基于 canonical URL（去除追踪参数/统一 scheme/host）作为 dedup_key。
  - 去重命中时不静默丢弃：提供“复用现有 source”或“仍创建新 source”的显式选择。
- **去重默认策略**：默认关闭（prod/dev 不区分）；仅在显式开启时启用去重检测与用户选择流程。
- **批量端点语义**：批量操作返回逐项结果（成功/失败原因），成功后统一 bump `sources_epoch`，失败不 bump 或按语义最小化 bump。

## Risks / Trade-offs

- [Schema 迁移与兼容性] → 通过 alembic 添加可空字段，保持旧数据可用；API 字段仅在存在时返回。
- [去重误判导致用户困惑] → 去重默认关闭（prod/dev 不区分）；启用时要求显式用户选择（复用/仍创建），并提供命中说明。
- [错误码过细导致维护成本] → 初期限定错误码集合，按实际问题扩展；保证向后兼容（不重命名，仅新增）。

## Migration Plan

- 增加 DB 字段（可空）并回填为 null。
- UI 渐进展示：先展示失败诊断与 recovery_hint，再加入去重交互与批量细化回显。

## Open Questions

- （无）
