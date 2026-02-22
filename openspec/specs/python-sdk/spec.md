# python-sdk Specification

## Purpose

定义 Python SDK 的生成与发布流程：SDK 必须与后端 OpenAPI 保持一致，支持自动化生成/校验，并为脚本化使用场景提供稳定的 API 调用体验（认证、错误处理、分页等）。

## Related specs

- `GLOSSARY.md`
- `openapi-docs/spec.md`
- `workspace-api/spec.md`
- `ci-cd/spec.md`

## Requirements
### Requirement: OpenAPI is the single SDK source of truth
系统 SHALL 以当前后端导出的 OpenAPI JSON 作为 SDK 生成的唯一输入（见 `openapi-docs/spec.md`）；schema 变更 MUST 通过重新生成 SDK 反映到 `sdk/client/python`。

### Requirement: Fern generates the Python SDK deterministically
系统 SHALL 使用 Fern 生成 Python SDK，并将生成产物落位在 `sdk/client/python`（视为自动生成内容）。生成流程 MUST 覆盖写入该目录，并生成/更新自动生成标记文件（例如 `.generated`）。

### Requirement: SDK version matches backend version
系统 SHALL 确保 SDK 版本与 `backend/py/pyproject.toml` 一致，并写入 `sdk/client/python/.sdk-version`。

### Requirement: CI validates SDK freshness
系统 SHALL 在 CI 中校验 `sdk/client/python` 与当前 OpenAPI schema 一致，并在不一致时 fail-fast（避免合入过期 SDK）；本仓库以 `just sdk-check` 作为一致性检查入口。

### Requirement: Publishing is out of scope for canonical spec
Python SDK 的 PyPI 发布策略（包名/Trusted Publishing/触发条件）不在本 canonical spec 中约束；如未来引入发布 workflow，发布前 MUST 先通过 freshness 校验。
