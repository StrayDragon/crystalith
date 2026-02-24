## Context

- `sources_epoch` 与 `vector_epoch` 用于版本化 cache key（例如 sources 列表、retrieval assembly、vector search cache）。
- 当前 bump 实现为 “get 当前 epoch → +1 → set 回去”，在并发写入下会发生丢失更新（lost update）。
- 该问题在 ingest/delete/re-embed 等高并发场景会表现为缓存失效不可靠，从而出现 UI/检索读到旧数据的短暂不一致。

## Goals / Non-Goals

**Goals:**
- 将 epoch bump 改为原子递增，保证并发下单调递增不丢失。
- 对 Redis 使用原子指令（`INCR`），对 in-memory 使用锁保护实现等价语义。
- 以最小接口扩展完成：新增 CacheProvider 的 `incr` 能力，并迁移所有 epoch bump 调用点。

**Non-Goals:**
- 不改变 epoch 的 key 命名策略与 cache TTL 设计（仅修复一致性/竞态问题）。
- 不引入新的缓存后端（仅完善现有 redis/in-memory）。

## Decisions

### 1) 在 CacheProvider 上新增 `incr` 原子递增接口
**Decision:** 扩展 CacheProvider 协议，新增 `incr(key, amount=1, ttl=...) -> int`，并在两种实现中提供：
- Redis：使用 `INCRBY`（必要时设置 TTL）
- InMemory：在同一把锁内读改写，保证原子性

**Rationale:** epoch bump 是跨模块共享的基础能力；将原子性下沉到缓存层可以避免每个调用点重复实现锁/事务。

### 2) 迁移 `bump_sources_epoch` / `bump_vector_epoch` 使用 `incr`
**Decision:** 所有 epoch bump 都通过 `cache.incr(..., ttl=0)` 完成（epoch 不过期）。

**Rationale:** 统一实现，避免未来新增 bump 仍使用 get+set 引入竞态。

## Risks / Trade-offs

- **[风险]** CacheProvider 协议变更导致调用点/实现遗漏 → **缓解**：任务中列出所有实现与调用点，并在测试中覆盖 bump 行为。
- **[风险]** Redis 中非整数值会导致 `INCR` 失败 → **缓解**：epoch key 仅由 bump 写入；并在实现中对解析失败进行“重置为 0 再 incr”的防御（必要时）。

## Migration Plan

- 先合入 CacheProvider 接口扩展与两种实现的 incr。
- 再迁移 epoch bump 调用点并补齐测试。
- 回滚：回滚到上一版本（恢复 get+set），或临时关闭并发写入路径（不推荐）。

## Open Questions

- `incr` 是否需要支持“仅当 key 不存在时设置 TTL”的语义（本次 epoch 使用 ttl=0 不需要，但未来可能需要）。
