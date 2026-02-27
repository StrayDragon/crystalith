## Context

当前后端在多个“非结构化边界”上使用 `Any`（例如：JSON payload、缓存值、插件输入输出、provider options），使得类型错误难以及早暴露；同时存在将 raw API key 直接拼入 cache key 的安全隐患。

## Goals / Non-Goals

**Goals:**
- 建立可运行的后端 typecheck 基线，并将结果保持可维护（不被第三方 stub 噪声淹没）。
- 以 `JsonValue`/`JsonDict` 作为 JSON 边界类型，减少 `Any` 外溢。
- 避免 cache key /日志/指标中出现 raw API key。

**Non-Goals:**
- 不改变业务逻辑与外部 API 合同。
- 不在本次强制把 typecheck 接入 CI gate（仅提供入口与配置）。
- 不引入新的运行时依赖（除 dev 工具与类型修正外）。

## Decisions

- **JSON-safe 边界类型**：新增 `backend/py/src/crystalith/shared/json_types.py`，统一定义 `JsonValue`/`JsonDict`，用于缓存、DB JSON 列与接口 payload 边界。
- **Protocol 协变修复**：对需要协变的只读字段使用 `@property` 暴露，避免可写属性导致的协议不匹配。
- **可选依赖延迟导入**：对 Playwright 等可选依赖采用运行时延迟导入，避免缺失时 hard fail，同时保持 typecheck 可通过。
- **OpenAI cache key 指纹化**：OpenAI client cache key 使用 SHA256 指纹而非 raw key，指纹稳定且不可逆，降低泄露风险。

## Risks / Trade-offs

- [类型更严格导致后续改动更“吵”] → 在 tests 执行环境下放宽 unknown/Any 报告，保持开发体验。
- [cache key 变更影响缓存命中] → 仅影响 client cache；同一 API key 的指纹稳定，行为不变（仅去除明文泄露面）。

## Migration Plan

- 无迁移步骤；更新代码即可。
- 如需回滚：恢复旧 cache key 生成逻辑并移除 basedpyright 配置与入口。

## Open Questions

- 是否需要在 CI 中加入 `cd backend/py && just typecheck` 作为必须检查？
