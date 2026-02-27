## Why

- 后端代码在多个边界（JSON payload / 插件接口 / cache / provider options）存在大量 `Any` 与不精确类型，导致静态检查难以作为质量门槛。
- OpenAI client 缓存 key 直接包含原始 API key，存在泄露风险（日志/监控/缓存可观察性等）。

## What Changes

- 增加后端静态类型检查入口：引入 `basedpyright` + 配置，并提供 `cd backend/py && just typecheck`。
- 在 JSON 边界引入 JSON-safe 类型（`JsonValue`/`JsonDict`），减少 `Any` 扩散并提升接口类型精度。
- 修复多处 Protocol/泛型不变性引起的类型错误（例如通过 `@property` 暴露只读属性）。
- 将 OpenAI client cache key 从“包含 raw API key”改为“包含 SHA256 指纹”，避免存储明文密钥。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `quality-and-regression`: 增加“后端 typecheck 可本地一键运行”的要求。
- `retrieval-and-cache`: 增加“cache key 不得包含 secret（如 API key）”的要求。

## Impact

- Backend: `backend/py` 的 shared 类型、AI provider、cache、extractor、web app 等模块的类型注解与接口收敛。
- Dev tooling: `basedpyright` 作为 dev 依赖、`just typecheck` 新任务。
- 行为影响：对外 API 无改动；仅内部 cache key 结构改变（不含 raw key）。
