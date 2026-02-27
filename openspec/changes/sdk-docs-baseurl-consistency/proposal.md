## Why

- 当前 SDK 文档示例把 `base_url` 写成 `http://localhost:8000`，但本仓库本地开发后端默认端口是 `8032`，而 Docker Compose 的对外入口是 `web` 的 `8080`（Nginx 反代 `/v1/*` 到内部 `api:8032`）。`8000` 在本仓库更常见地对应 Chroma 等可选服务端口。这个不一致会直接导致用户照着文档运行失败，降低“开箱即用”的体验与文档可信度。

## What Changes

- 修正 SDK 文档示例中的 `base_url`：
  - 本地开发（`cd backend/py && just dev`）：使用 `http://127.0.0.1:8032`。
  - Docker Compose：使用 `http://localhost:${CL_WEB_PORT:-8080}`（与 Web UI 相同的前门地址）。
- 在 SDK 文档中补充一条明确提醒：`8000` 可能是可选依赖（例如 Chroma）的端口，不是 Crystalith API。
- （可选）在 `Getting Started / Deployment` 中补充“API 通过 Nginx 前门暴露”的一句话，避免用户尝试直接访问未暴露的 API 端口。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `delivery-and-deployment`: 部署/使用文档中的示例与入口必须与实际拓扑一致，尤其是 SDK `base_url` 的推荐值必须可直接工作。

## Impact

- Docs: 需要更新 `docs/content/sdk-python.md`、`docs/content/sdk-typescript.md`（以及可能的 `docs/content/getting-started.md` / `docs/content/deployment.md` 的补充说明）。
- CI/Build: 不涉及后端 API 与生成链路变更；需要保证 `just docs-build` 仍可通过。
