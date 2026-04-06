# sdk（SDK 生成配置）

> TL;DR：本目录存放 SDK 生成相关的配置与生成器补丁：Fern 的 `generators.yml` 以 `frontend/web/openapi.gen.json` 为输入，输出到 `vendor/crystalith-sdks/*`（submodule）。生成的实际代码位于 `vendor/`，而不是本目录。生成入口主要由根目录 `justfile` 与 `scripts/sdk_gen.sh` 提供。

## Scope（责任边界）

### 做什么
- Fern 配置：
  - Fern 项目配置：`sdk/configs/fern/fern.config.json`
  - Fern 生成器组配置：`sdk/configs/fern/generators.yml`（输入 OpenAPI：`frontend/web/openapi.gen.json`；输出目录：`vendor/crystalith-sdks/*`）
- 生成器补丁（主要是 Go 网络问题）：
  - `sdk/generators/fern-go-sdk/Dockerfile`：为 `fernapi/fern-go-sdk:1.26.0` 注入 `GOPROXY/GOSUMDB`

### 不做什么
- 不承载生成出来的 SDK 源码（生成物在 `vendor/crystalith-sdks/*`，并受 submodule 管理：`.gitmodules`）。
- 不负责导出 OpenAPI（导出脚本在后端：`backend/py/scripts/api_schema.py`；统一入口：根目录 `justfile:api-export`）。

## Integration（与项目的关系）

### 上游依赖
- OpenAPI 输入文件：`frontend/web/openapi.gen.json`（生成入口：根目录 `justfile:api-export`；也可由前端 `frontend/web/package.json:scripts.api:fetch` 拉取）。
- 版本源：后端版本来自 `backend/py/pyproject.toml:[project].version`（被 `scripts/sdk_gen.sh` 通过 `scripts/sdk_version.py` 读取）。

### 下游使用者
- `vendor/crystalith-sdks` submodule（monorepo）：包含 Python/TS/Go/Rust SDK（目录存在性：`vendor/crystalith-sdks/*`；说明：`vendor/crystalith-sdks/DEVELOPMENT.md`）。
- 发布流程（高副作用）：`scripts/sdk_release.sh` 会在 submodule 与主 repo 内提交/打 tag（入口：根目录 `justfile:sdk-release`）。

### 依赖关系图
~~~text
backend/py API -> backend/py/scripts/api_schema.py -> frontend/web/openapi.gen.json
                                              |
                                              +--> sdk/configs/fern/generators.yml (fern generate)
                                                     |
                                                     +--> vendor/crystalith-sdks/{python,typescript,go,rust}
~~~

## Core Logic（核心概念与核心数据流）

### 术语表
- Fern：SDK 生成工具（在 `scripts/sdk_gen.sh` 中通过 `fern generate --local ...` 调用）。
- generator group：`python-sdk` / `go-sdk` / `rust-sdk`（定义：`sdk/configs/fern/generators.yml`）。
- submodule：`vendor/crystalith-sdks` 是 git submodule（定义：`.gitmodules`）。

### 主流程（生成 SDK）
1. 确保 OpenAPI 是最新：
   - `just api-export` 写入 `frontend/web/openapi.gen.json`（根目录 `justfile:api-export`）
2. 生成 SDK（由脚本驱动）：
   - `just sdk-gen-python` / `just sdk-gen-go` / `just sdk-gen-rust` / `just sdk-gen-typescript`（根目录 `justfile`）
   - 脚本实际执行：`scripts/sdk_gen.sh`
3. Go 特殊处理（可选）：
   - 当 `FERN_GO_SDK_PATCH_IMAGE` 触发 patch 时，脚本会 build 本地镜像 `fernapi/fern-go-sdk:1.26.0`（Dockerfile：`sdk/generators/fern-go-sdk/Dockerfile`；逻辑：`scripts/sdk_gen.sh`）。

### 重要边界条件
- 版本一致性：`scripts/sdk_gen.sh` 要求显式传入的 VERSION 与后端版本一致（脚本读取 `python scripts/sdk_version.py get-backend`）。
- 生成物不要手改：`scripts/sdk_gen.sh` 会写入 `.generated` 标记与 LICENSE 复制，提示这些目录是生成物（例如 Python SDK：`vendor/crystalith-sdks/python/.generated`）。

## Dev / Run / Test（开发者使用指南）
```bash
# repo root：生成 SDK（会写 vendor/crystalith-sdks/*；谨慎执行）
just sdk-gen-python
just sdk-gen-go
just sdk-gen-rust
just sdk-gen-typescript

# repo root：一次性生成（导出 schema + 前端 client + Python SDK）
just sdk-gen                          # 依据：justfile:sdk-gen
```

```bash
# submodule 准备（会更新 submodule；谨慎执行）
just sdk-submodule-update             # 依据：justfile:sdk-submodule-update
```

```bash
# release（高副作用：commit/tag/push；谨慎执行）
just sdk-release X.Y.Z                # 依据：justfile:sdk-release + scripts/sdk_release.sh
```

## Config / Observability（配置与可观测性）
- Fern generators 配置：`sdk/configs/fern/generators.yml`
- Go patch 开关：`FERN_GO_SDK_PATCH_IMAGE`（逻辑：`scripts/sdk_gen.sh`）
- SDK monorepo 维护说明：`vendor/crystalith-sdks/DEVELOPMENT.md`

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 给每个 generator group 补充“输入/输出/版本”说明（动机：维护者上手；收益：少踩坑；风险：维护；方案：以 `sdk/configs/fern/generators.yml` 与 `scripts/sdk_gen.sh` 为依据写清楚）。
  - 把 `FERN_GO_SDK_PATCH_IMAGE` 的触发条件写进 docs（动机：网络差异常见；收益：更可控；风险：文档漂移；方案：基于 `scripts/sdk_gen.sh` 的 auto 探测逻辑描述清楚）。
- 中期（1–2 月）
  - 增加 SDK 生成的 drift gate（动机：防止忘记更新生成物；收益：更稳；风险：CI 时间；方案：利用根目录 `justfile:sdk-check` / `justfile:sdk-check-typescript` 的现有检查机制扩展覆盖范围）。
  - 让 SDK 生成对 schema 漂移更敏感（动机：保证契约；收益：更早失败；风险：更严格；方案：强化 `just api-check` + `scripts/sdk_version.py check-schema` 的组合（见 `scripts/sdk_gen.sh` 已调用））。
- 长期（季度+）
  - 建立“SDK 行为变更”与“OpenAPI 变更”的追溯链（动机：发布治理；收益：更可审计；风险：流程成本；方案：将 release 流程（`scripts/sdk_release.sh`）与 openspec 变更工作区关联（例如在 change tasks 中记录 SDK 变更验证项）。

## Assumptions / TODO to Verify（已知未知）
- `fern` CLI 的安装/获取方式是否在仓库内有明确约定：目前生成脚本直接调用 `fern generate`（`scripts/sdk_gen.sh`），需在开发文档或环境准备中确认。
- TypeScript SDK 的生成是否完全由 `openapi-ts` 驱动：脚本 `scripts/sdk_gen.sh` 的 typescript 分支调用 `pnpm -C vendor/crystalith-sdks/typescript run generate`，需在 `vendor/crystalith-sdks/typescript/` 内部确认该脚本内容与依赖（该目录在 submodule 内）。
