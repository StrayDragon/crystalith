# Python SDK

## 概述
Python SDK 由后端 OpenAPI schema 通过 Fern 生成，存放于：

- `vendor/crystalith-sdks/python`（git 子模块）

导入包路径为：
- `vendor/crystalith-sdks/python/src/crystalith_sdk`

Fern 配置位于：
- `sdk/configs/fern/fern.config.json`
- `sdk/configs/fern/generators.yml`

## 版本管理
- SDK 版本来源于 `backend/py/pyproject.toml`，在生成时写入 `vendor/crystalith-sdks/python/.sdk-version`。
- 可通过 `just sdk-gen-python VERSION=X.Y.Z` 覆盖，但必须与后端版本一致。

## 安装

```bash
pip install crystalith-sdk
```

## 最小示例

Base URL（不含 `/v1`）：
- 本地开发（`cd backend/py && just dev`）：`http://127.0.0.1:8032`
- Docker Compose（与 Web UI 同一入口）：`http://localhost:${CL_WEB_PORT:-8080}`

注意：端口 `8000` 通常为可选依赖（如 Chroma），不是 Crystalith API。
认证（可选）：若 `app.auth.enabled=true`，需发送 `Authorization: Bearer <token>`（或 `X-API-Key: <token>`）。

```python
import os

from crystalith_sdk import CrystalithClient

api_key = os.environ.get("CRYSTALITH_API_KEY")
headers = {"Authorization": f"Bearer {api_key}"} if api_key else None

client = CrystalithClient(base_url="http://127.0.0.1:8032", headers=headers)

notebooks = client.notebooks.list_notebooks()
notebook = client.notebooks.create_notebook(name="Demo")

with open("example.pdf", "rb") as f:
    client.sources.upload_source(notebook.id, file=("example.pdf", f))

qa = client.qa.ask_question(notebook.id, question="Summarize the uploaded source.")
print(qa.answer)

output = client.outputs.create_output(notebook.id, "BRIEFING")
print(output.id, output.type)
```

## CI 约束

- `frontend/web/openapi.gen.json` 必须与后端 schema 保持同步（CI 会执行 `uv run scripts/api_schema.py check`）。
- 生成的 API 客户端必须提交（CI 会执行 `pnpm run api:generate` 并检查 diff）。
- Python SDK 必须能成功构建，且版本需与后端一致（CI 会执行 `just sdk-version-check` + `just sdk-build-python`）。

## 自动化

- GitHub Actions：
  - `Check Python SDK`：执行 `just api-check` + `just sdk-version-check` + `just sdk-build-python`。
- Fern：
  - 本地生成使用 Fern CLI（`npm install -g fern-api@3.73.1`）和 Docker（`fern generate --local`）。
  - 仅远程生成时需要 `FERN_TOKEN` / `fern login`。

## 本地生成

```bash
# Ensure the SDK monorepo submodule is present
git submodule update --init --recursive vendor/crystalith-sdks

# Generate all SDKs (export schema + frontend + Python)
just sdk-gen

# Generate Python SDK only
just sdk-gen-python

# Check if Python SDK is up to date (for pre-commit)
just sdk-check

# Build Python SDK (wheel/sdist)
just sdk-build-python

# Check versions match backend (Python + TypeScript)
just sdk-version-check
```

## 发布流程（PyPI）

推荐：在主 `crystalith` 仓库中执行：

```bash
just sdk-release X.Y.Z
```

由于 Python 包位于 `crystalith-sdks` git 子模块内，发布由 SDK 单体仓库中的 tag 触发：

- `python/vX.Y.Z`（在 `crystalith-sdks` 中）

如需手动发布，流程如下：

1. 在 `crystalith-sdks` 中生成、提交并推送 SDK 变更
2. 在 `crystalith` 中更新子模块指针（提交并推送）
3. 执行 `just sdk-release-check`
4. 在 `crystalith-sdks` 中创建 tag `python/vX.Y.Z` 并推送（触发发布）

## 说明
- 生成的 README.md 由 Fern 生成器管理。
- 请勿手动编辑生成的文件；修改应通过后端 API 进行。
- Fern 生成 SDK 时可能需要登录或配置 `FERN_TOKEN`。
