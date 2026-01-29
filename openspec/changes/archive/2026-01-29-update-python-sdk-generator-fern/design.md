## Context
- 目前 SDK 由 openapi-python-client 生成，产出命名与结构较弱。
- Fern 提供更高质量的 SDK 生成器，但需要配置与本地生成流程。

## Goals / Non-Goals
- Goals:
  - 使用 Fern 生成 Python SDK。
  - SDK 版本与 `backend/py/pyproject.toml` 保持一致。
  - 继续将生成产物写入 `sdk/client/python`。
- Non-Goals:
  - 不在本次改动中自动化 Fern 登录/发布流程。

## Decisions
- Decision: 使用 Fern（`fern-api` CLI）作为 SDK 生成器。
- Decision: OpenAPI 输入继续来自 `frontend/web/openapi.json`。
- Decision: SDK 版本与后端版本强一致（不允许偏离）。
- Decision: 生成后写入 `sdk/client/python/.sdk-version` 作为版本标记文件。

## Risks / Trade-offs
- Fern 生成的打包文件（如 pyproject）可能依赖 Fern 计划或配置，需要确认生成产物完整性。
- Fern 生成流程需要 CLI 登录或 token，CI 无自动执行时需人工触发。

## Migration Plan
1. 引入 Fern 配置与生成器定义。
2. 更新生成脚本与 Just 命令。
3. 更新版本校验规则与文档。
