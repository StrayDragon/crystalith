# TypeScript SDK

## 概述

TypeScript SDK 由后端 OpenAPI schema 生成，打包为 npm 包。

- npm 包：`@crystalith/sdk`
- 仓库包根目录：`vendor/crystalith-sdks/typescript`（git submodule）
- 生成的客户端源码：`vendor/crystalith-sdks/typescript/src/generated`

Web UI 仍使用 `frontend/web/src/api/generated` 下的生成客户端。

## 版本 / 对齐

- SDK 版本与 `backend/py/pyproject.toml` 和发布标签（`vX.Y.Z`）保持一致。
- 检查对齐：`just sdk-version-check`。

## 安装

```bash
npm install @crystalith/sdk
```

## 本地生成（仓库内）

```bash
git submodule update --init --recursive vendor/crystalith-sdks
just api-export
just sdk-gen-typescript
just sdk-build-typescript

# 漂移检查（重新生成 + git status）
just sdk-check-typescript
```

## 发布流程（npm）

推荐：在 `crystalith` 主仓库中运行：

```bash
just sdk-release X.Y.Z
```

由于 npm 包位于 `crystalith-sdks` git submodule 内，发布由 SDK monorepo 中的标签触发：

- `typescript/vX.Y.Z`（在 `crystalith-sdks` 中）

如需手动操作，发布流程为：

1. 在 `crystalith-sdks` 中生成 + 提交 + 推送 SDK 变更
2. 在 `crystalith` 中更新 submodule 指针（提交 + 推送）
3. 运行 `just sdk-release-check`
4. 在 `crystalith-sdks` 中打标签 `typescript/vX.Y.Z` 并推送（触发发布）

## 最小示例

Base URL（不含 `/v1`）：
- 本地开发（`cd backend/py && just dev`）：`http://127.0.0.1:8032`
- Docker Compose（与 Web UI 相同入口）：`http://localhost:${CL_WEB_PORT:-8080}`

注意：端口 `8000` 通常是可选依赖（如 Chroma），不是 Crystalith API。
认证（可选）：如果 `app.auth.enabled=true`，发送 `Authorization: Bearer <token>`（或 `X-API-Key: <token>`）。

```ts
import {
  listNotebooksV1NotebooksGet as listNotebooks,
  client,
} from '@crystalith/sdk';

const apiKey = '<token>'; // 可选

client.setConfig({
  baseUrl: 'http://127.0.0.1:8032',
  headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  responseStyle: 'fields',
  throwOnError: true,
});

const res = await listNotebooks<true>();
console.log(res.data);
```
