## Why
- 现有 OpenAPI 生成的 Python SDK 可读性与使用体验不足。
- 需要使用 Fern 生成更高质量的 Python SDK，并确保版本与后端一致。

## What Changes
- 引入 Fern 配置并切换 SDK 生成器到 Fern。
- 更新 SDK 生成脚本与 Just 命令，改为 Fern 生成。
- SDK 版本严格与 `backend/py/pyproject.toml` 同步，并写入 `sdk/client/python/.sdk-version`。

## Impact
- 受影响规范：`python-sdk`。
- 受影响代码/配置：`scripts/sdk/*`、`sdk/client/python`、Fern 配置、GitHub Actions 文档说明。
