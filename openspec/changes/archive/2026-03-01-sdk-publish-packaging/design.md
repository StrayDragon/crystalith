## Context

- 现状：
  - Python SDK 由 Fern 基于 `frontend/web/openapi.json` 生成到 `sdk/client/python`，并在 CI 中做“生成后无 diff”的漂移校验，但该目录目前不是一个可直接发布到 PyPI 的标准 Python 包（缺少明确的 packaging 元数据与发布流水线）。
  - TypeScript 客户端生成目前仅服务于前端应用（生成到 `frontend/web/src/api/generated`），没有独立的 npm SDK 包与发布流程。
- 目标是把“仓库内生成 + 提交”的产物升级为“可安装、可版本化、可追溯”的 SDK 交付。

## Goals / Non-Goals

**Goals:**

- Python/TypeScript SDK 都具备可发布包形态：
  - Python：可构建 wheel/sdist 并发布到 PyPI（或 TestPyPI）。
  - TypeScript：可 `npm pack`/`npm publish` 发布到 npm。
- 版本与发布一致性：
  - 发布从 tag（`vX.Y.Z`）触发；
  - 发布前校验：tag 版本与版本源文件一致；SDK 产物与该版本一致；可复现构建。
- CI 守护：
  - PR 上检查 SDK 再生成是否产生 diff（Python + TS）。
  - tag 发布工作流产出并发布构建产物（并上传到 GitHub Release 作为可追溯附件）。

**Non-Goals:**

- 不改变后端 API 设计/路径，不引入新业务能力。
- 不一次性覆盖 Go/Rust 等更多语言 SDK（可在后续 change 迭代）。
- 不强依赖 Fern 生成 TypeScript（允许先采用与前端一致的 `openapi-ts` 路径）。

## Decisions

1. **版本源与发布触发**
   - 以 git tag `vX.Y.Z` 作为发布触发点，并要求该版本与后端版本源（例如 `backend/py/pyproject.toml`）一致。
   - 发布流水线在构建前执行一致性校验（不匹配则失败），避免“tag 是 0.2.0，但 SDK 生成仍是 0.1.0”。

2. **Python SDK：可发布包封装**
   - 将 `sdk/client/python` 作为发布单元，补齐 `pyproject.toml`、依赖声明、README/许可证纳入包分发清单，并支持 `python -m build` 产出 wheel/sdist。
   - 包名/导入名策略：
     - 推荐：PyPI 包名使用 `crystalith-sdk`（或等价可用名称），并将导入名与后端服务包区分（例如 `crystalith_sdk`），避免与后端代码包 `crystalith` 混淆/冲突。
     - 这需要调整 Fern 生成配置的 `package_name`，并同步更新 SDK 文档示例。

3. **TypeScript SDK：独立 npm 包**
   - 新增 `sdk/client/typescript/` 作为 npm 包根目录，包含 `package.json`、构建配置、发布脚本与生成输出目录。
   - 生成方式优先复用前端已使用的 `openapi-ts`（保证与前端一致），将其输出定向到该包内；构建产物建议输出为 ESM（并保留类型声明）。
   - npm 包名优先使用 scoped 包（如 `@crystalith/sdk`）以降低重名风险；若无组织域名则退化到非 scoped 名称（需要提前占位验证）。

4. **CI 与 Release 工作流**
   - 增加 “Check TypeScript SDK” 工作流：再生成 `sdk/client/typescript` 并 `git diff --exit-code`。
   - 增加 tag 发布工作流：
     - 构建 Python wheel/sdist 并发布（需要 `PYPI_API_TOKEN`）。
     - 构建并 `npm publish` TypeScript 包（需要 `NPM_TOKEN`）。
     - 将产物（wheel/sdist/`npm pack` tarball + schema）上传到 GitHub Release。

## Risks / Trade-offs

- **[风险] 包名重名或不可用** → **缓解**：在变更早期完成 PyPI/npm 名称占位与验证；必要时采用 scoped 包名或带后缀的分发名。
- **[风险] 导入名与后端包冲突导致用户困惑** → **缓解**：推荐导入名与服务端区分（`crystalith_sdk`），并在文档中明确“这是客户端 SDK 包”。
- **[风险] 发布 secrets/权限配置复杂** → **缓解**：先接入 TestPyPI 或 dry-run 发布；把发布权限限制为 tag 触发并最小化 `permissions`。
