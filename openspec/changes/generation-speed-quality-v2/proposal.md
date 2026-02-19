## Why

当前生成链路在「质量优先」路径中会触发多查询检索（multi-query retrieval）与多次向量检索缓存读写；在启用 Redis 缓存与 Chroma 向量库的线上环境里，**多次缓存 GET/SET 的网络往返**会放大 p95/p99 延迟，成为可见瓶颈。

同时，不同输出类型（FAQ/Guide/Timeline/Quiz/Briefing/等）对上下文覆盖度与去噪强度的需求不同，但目前检索默认值较统一，导致某些类型在「质量」模式下仍可能证据不足或覆盖不够。

## What Changes

- 扩展缓存抽象（CacheProvider）以支持批量读写（`get_many` / `set_many`），并在 InMemoryCache/RedisCache 中实现。
- 将向量检索缓存的多查询路径改为批量缓存读取与批量写入，减少 Redis 往返次数（尤其是在 multi-query / search_many 场景）。
- 引入“输出类型 + 生成倾向（质量/速度）”的检索调参入口，使 tool 类型输出在质量模式下默认覆盖更充分、速度模式下更克制（不改变显式传参的行为）。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `backend-performance`: CacheProvider 接口支持批量读写；多查询检索缓存应尽量以批量操作降低延迟。
- `vector-storage`: 向量检索应支持批量 query（`search_many`）以减少调用开销，并在 Chroma 查询中避免不必要的 include 字段以降低 payload。

## Impact

- Backend
  - `backend/py/src/crystalith/shared/cache/*`：新增批量缓存接口与实现。
  - `backend/py/src/crystalith/shared/vector_storage/cached.py`：多查询缓存路径使用批量操作。
  - `backend/py/tests/*`：补充批量缓存与多查询缓存行为测试。
- API 形状保持不变（仅默认策略/性能行为变化；显式传参优先）。
- 预期收益：multi-query 场景 Redis 往返次数显著下降，生成端到端延迟下降；tool 类型输出在质量模式下上下文覆盖更好。
