# 设计：前端 API 客户端简化

## 现状（已观察）
- `frontend/web/src/api/generated/client.gen.ts` 提供了配置后的生成客户端。
- `frontend/web/src/api/client.ts` 对生成端点做封装，增加 `ApiError` + `handleResponse`，并对若干端点使用手写 `fetch`（SSE、extractors、转换等）。
- 业务模块通过封装层获取函数与类型，导致该层发生变动时需要频繁同步。

## 决策驱动
- 降低 API 变化带来的维护成本。
- 让调用点更直接、易发现。
- 避免破坏现有行为或错误提示。
- 减少无法生成的端点导致的重复包装。

## 方案对比
### 方案 A：直接使用生成 SDK + 极小手写模块（推荐）
- 业务代码直接使用 `frontend/web/src/api/generated` 导出的函数。
- 仅在生成端点无法覆盖时使用极小的手写模块，例如：
  - SSE QA 流
  - OpenAPI 尚未覆盖的端点
- 为手写调用保留单独的错误处理辅助模块。

**优点：** 维护成本最低，生成与手写边界清晰。
**缺点：** 业务模块的生成函数导入较多，测试需要更新 mock。

### 方案 B：保留薄封装
- 保留 `client.ts` 作为轻薄的再导出与错误处理层。
- 非生成端点迁移到独立模块，不再复刻生成函数签名。

**优点：** 调用方改动最小。
**缺点：** 封装层仍是维护热点，易与 OpenAPI 漂移。

### 方案 C：补齐 OpenAPI 并移除手写调用
- 在后端补齐缺失端点的 OpenAPI 定义并重新生成 SDK。
- 移除所有手写调用。

**优点：** API 面最干净、类型最一致。
**缺点：** 前期投入更大，需要后端配合。

## 选择方向
先采用方案 A。可直接使用生成 SDK 的地方全部改为直连；手写调用收敛到极小模块，并明确标注无法生成的原因。若后续维护成本仍偏高，再考虑推进补齐 OpenAPI。

## 生成客户端最佳实践（Hey API）
- 优先直接调用生成 SDK 的函数，避免逐端点二次封装。通过 `client.setConfig()` 在应用启动时统一配置（baseUrl / headers / interceptors）。
- 使用 `client.interceptors` 统一注入认证头、请求/响应转换或错误规范化，而不是在每个端点处理。
- 若需要针对特殊环境（测试/多 baseUrl），可通过 `createClient()` 或为单次调用传入 options 覆盖。

## SSE 支持评估
- 生成的 Fetch 客户端内置 SSE 支持，可通过 `client.sse.<method>` 和生成的 `serverSentEvents` 解析器直接使用。
- `POST /qa/stream` 的 SDK 函数仍使用 `client.post`，不会自动启用 SSE。为避免额外 wrapper，可在业务层直接调用 `client.sse.post`，并将 `onSseEvent` 对接现有回调。
- 该方式让 SSE 由生成客户端处理，同时移除自定义 `fetch` 流解析器。

## 风险
- 触及文件多、改动面大。
- 生成与手写调用的错误结构可能不一致。
- 测试的 mock 路径需要更新。

## 待确认问题
- 现在是否要把缺失端点补进 OpenAPI？还是先保留小型手写模块？
- 是否继续保留 `ApiError` 形式，还是改用生成客户端的错误结构？
