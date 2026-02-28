## Context

- 当前 SDK 文档（Python/TypeScript）示例把 `base_url`/`baseUrl` 写成 `http://localhost:8000`，与仓库的实际运行拓扑不一致：
  - 本地后端开发默认 `PORT=8032`；
  - Docker Compose 对外暴露的是 `web`（Nginx）前门端口 `CL_WEB_PORT`（默认 8080），并通过反代把 `/v1/*` 转发到内部 `api:8032`；
  - `8000` 在本仓库更常见地用于可选依赖（例如 Chroma）端口。
- 用户按文档操作时，最容易遇到“连不上/404/连接被拒绝”的第一印象问题。

## Goals / Non-Goals

**Goals:**

- 让 SDK 文档示例在两种主流运行方式下都能直接工作：
  - 本地开发：明确 `http://127.0.0.1:8032`
  - Compose：明确 `http://localhost:${CL_WEB_PORT:-8080}`
- 用一句话消除端口误解：`8000` 不是 Crystalith API 端口（常见为 Chroma/可选服务）。

**Non-Goals:**

- 不改动任何运行端口、compose 服务暴露策略或反代规则。
- 不改动 OpenAPI、生成客户端或 SDK 代码生成流程（仅修正文档与示例）。

## Decisions

1. **示例默认指向本地开发端口 `8032`**
   - 原则：文档示例应在“最小依赖、本地开发”路径下开箱即用。
   - 因此 Python/TS SDK 的 minimal example 默认使用 `http://127.0.0.1:8032`。

2. **补充 Compose 前门地址作为推荐替代**
   - 在示例附近增加“如果使用 Docker Compose，请将 base_url 设置为 Web UI 同地址”的提示，并给出 `http://localhost:${CL_WEB_PORT:-8080}`。

3. **明确写出端口语义，避免再次漂移**
   - 在两份 SDK 文档中加入同一条短提示：`8000` 可能是 Chroma 等可选服务端口，并非 API。
   - （可选）在 Getting Started/Deployment 中补充“API 通过 Nginx 前门访问”的一句话，形成闭环。

## Risks / Trade-offs

- **[风险] 用户有自定义端口/反向代理路径** → **缓解**：文档明确“按你的部署入口替换 base_url”，并提供两个最常见的默认值作为起点。
- **[风险] 未来端口或拓扑再次调整导致示例漂移** → **缓解**：在部署规范中加入“示例必须与入口一致”的要求，并在 PR/CI review 时把 SDK 文档纳入检查清单。
