## 1. Python SDK：可发布包形态

- [ ] 1.1 明确 PyPI 分发名与 Python 导入名策略（避免与后端 `crystalith` 包混淆/冲突）。
- [ ] 1.2 为 `sdk/client/python` 补齐 Python packaging 元数据（`pyproject.toml`、README、license/include 配置）并声明运行时依赖（如 `httpx`、`pydantic` 等）。
- [ ] 1.3 调整 Fern 生成配置（如需）以匹配新的包名/导入名，并确保生成仍可重复（生成后无 diff）。
- [ ] 1.4 增加本地构建命令（wheel/sdist）并在 CI 发布路径中执行构建校验。

## 2. TypeScript SDK：独立 npm 包

- [ ] 2.1 新增 `sdk/client/typescript/` 包骨架（`package.json`、构建脚本、类型声明输出、README/许可证纳入）。
- [ ] 2.2 复用 `openapi-ts`（或 Fern TS generator）把 OpenAPI 生成输出定向到该包内，确保与前端应用生成策略一致。
- [ ] 2.3 增加“TS SDK 漂移检查”工作流：生成后 `git diff --exit-code`，在 PR/主分支上运行。

## 3. Release：tag 驱动发布与产物归档

- [ ] 3.1 新增 tag 发布工作流（`vX.Y.Z`）：校验版本一致性 → 生成 SDK → 构建产物 → 发布到 PyPI/npm → 上传 artifacts 到 GitHub Release。
- [ ] 3.2 梳理并最小化所需 secrets/permissions（PyPI token、npm token、`packages: write`/`id-token` 等），并提供 dry-run/TestPyPI 预演路径（可选）。

## 4. Docs：对外可用的安装与使用入口

- [ ] 4.1 更新 `docs/content/sdk-python.md` 与 `docs/content/sdk-typescript.md`：补充“安装方式（pip/npm）+ 版本策略 + 生成来源（OpenAPI）”说明。

## 5. Verification

- [ ] 5.1 Python：生成 + 构建通过（wheel/sdist），并可在干净环境中安装后完成最小请求（如 list notebooks）。
- [ ] 5.2 TypeScript：`npm pack` 产物可安装并能在 TS 项目中编译通过（类型声明可用）。
- [ ] 5.3 CI：PR 上漂移检查可稳定复现；tag 发布工作流可在 dry-run 环境验证通过。
