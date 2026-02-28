## 1. SDK 文档示例修正

- [x] 1.1 更新 `docs/content/sdk-python.md`：将示例 `base_url` 修正为本地开发默认 `http://127.0.0.1:8032`，并补充 Compose 前门 `http://localhost:${CL_WEB_PORT:-8080}` 的说明。
- [x] 1.2 更新 `docs/content/sdk-typescript.md`：将示例 `baseUrl` 修正为本地开发默认 `http://127.0.0.1:8032`，并补充 Compose 前门 `http://localhost:${CL_WEB_PORT:-8080}` 的说明。
- [x] 1.3 在两份 SDK 文档中加入一条显式提醒：`8000` 可能是 Chroma 等可选服务端口，不是 Crystalith API 入口。

## 2.（可选）部署文档补齐一句话

- [x] 2.1 在 `docs/content/getting-started.md` 或 `docs/content/deployment.md` 补充“API 通过 Nginx 前门访问（/v1/* 反代到 api）”的简短说明，降低误解概率。

## 3. Verification

- [x] 3.1 `rg -n \"localhost:8000\" docs/content` 结果应为空
- [x] 3.2 `just docs-build`
