## Why

生成链路涉及多段 I/O（embedding、vector search、LLM 调用、DB 持久化）。在高并发或用户快速重复触发时，若缺少明确的并发与取消边界，容易出现：

- embed/search/model 调用并发失控导致资源争用与尾延迟放大（p95/p99 抖动）
- 请求取消/断开后仍继续执行昂贵步骤，浪费算力并放大队列拥塞
- 429/503 等可重试错误未统一遵循 Retry-After 或退避策略，造成“雪崩式重试”

## What Changes

- 为关键阶段增加可配置的并发护栏（例如：embedding 并发、vector search 并发、LLM 生成并发），并确保在 HTTP 请求取消时能尽早停止后续阶段。
- 统一 rate limit/timeout 的处理策略：优先遵循 Retry-After；避免嵌套重试；对不同阶段采用不同上限。
- 在日志中补齐并发/限流相关字段（例如 limiter 命中、等待耗时、是否被取消），为压测与线上排障提供依据。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `backend-performance`: 系统 MUST 对关键 I/O 阶段施加并发限制与取消语义，避免资源争用导致的尾延迟失控。
- `agent-architecture`: Agent/Graph 节点 SHOULD 在请求取消时尽早停止，并确保可重试错误遵循统一策略。
- `background-task-queue`: 队列执行路径 MUST 遵循同样的并发/重试上限，避免后台任务与前台请求互相挤占资源。

## Impact

- Backend
  - `backend/py/src/crystalith/shared/*`：并发 limiter、重试/取消策略抽象与复用。
  - `backend/py/src/crystalith/features/*`：在 outputs/slides/refine/qa 等入口应用 limiter，并补齐 observability。
  - `backend/py/tests/*`：并发限制与取消语义的回归测试（使用 stub provider，不依赖外网）。
- 默认值以安全为先，允许通过配置调整；不引入 BREAKING API。
