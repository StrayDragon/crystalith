# vendor（第三方/外部仓库）

> TL;DR：本目录用于托管“外部/第三方仓库形式”的依赖，目前包含 `vendor/crystalith-sdks` git submodule（定义：`.gitmodules`），它是多语言 SDK 的发布仓库（说明：`vendor/crystalith-sdks/README.md` 与 `vendor/crystalith-sdks/DEVELOPMENT.md`）。本目录内容通常不应被业务代码直接修改，而应通过生成/更新 submodule 指针完成。

## Scope（责任边界）

### 做什么
- 承载 git submodule：
  - `vendor/crystalith-sdks`（定义：`.gitmodules`；内容：`vendor/crystalith-sdks/*`）
- 作为 SDK 生成输出目录：
  - Fern/OpenAPI 等生成会写入该 submodule 的各语言目录（生成入口：`scripts/sdk_gen.sh`，配置：`sdk/configs/fern/generators.yml`）。

### 不做什么
- 不直接手工修改生成文件（SDK 代码是生成物；生成器会写 `.generated` 提示，见 `scripts/sdk_gen.sh`）。
- 不替代前端 submodule（例如 `frontend/web/vendor/rivu` 虽也在 `.gitmodules` 中，但它不在本目录；其初始化脚本：`scripts/ensure_rivu_submodule.sh`）。

## Integration（与项目的关系）

### 上游依赖
- OpenAPI schema：`frontend/web/openapi.gen.json`（导出：`justfile:api-export`；前端同步：`frontend/web/package.json:scripts.api:sync`）。
- SDK 生成配置：`sdk/configs/fern/generators.yml` 指向输出路径 `../../../vendor/crystalith-sdks/...`。

### 下游使用者（已知）
- 发布工作流在 submodule 仓库内触发：
  - 语言前缀 tags：`python/vX.Y.Z`、`typescript/vX.Y.Z`、`go/vX.Y.Z`、`rust/vX.Y.Z`（说明：`vendor/crystalith-sdks/DEVELOPMENT.md`）。
- 主仓库 release/同步脚本会更新 submodule 指针：
  - `scripts/sdk_release.sh` 会对 submodule 与主仓库执行 commit/tag/push（高副作用）。

### 依赖关系图
~~~text
sdk/configs/fern + scripts/sdk_gen.sh  ---> writes ---> vendor/crystalith-sdks/* (submodule)
                                           |
                                           +--> published by tags in vendor/crystalith-sdks (see DEVELOPMENT.md)
main repo records submodule pointer (gitlink) ---> must be committed (see justfile:sdk-release-preflight)
~~~

## Core Logic（核心概念与数据流）

### 术语表
- git submodule：主仓库记录一个指针（commit SHA）指向外部仓库（定义：`.gitmodules`）。
- submodule pointer：更新 submodule 内容后，主仓库需要提交新的指针（release 预检中会校验：`justfile:sdk-release-preflight`）。
- SDK monorepo：`vendor/crystalith-sdks` 作为多语言 SDK 发布仓库（`vendor/crystalith-sdks/README.md`）。

### 推荐流程（与仓库脚本一致）
- `just sdk-release X.Y.Z` 会驱动：
  1) 同步 OpenAPI + 前端 client（`justfile:sdk_release.sh` 内调用 `just api-sync`）
  2) 生成各语言 SDK（`scripts/sdk_gen.sh`）
  3) 在 submodule 仓库 commit/tag/push
  4) 更新主仓库 submodule 指针并推送（脚本：`scripts/sdk_release.sh`；发布说明：`vendor/crystalith-sdks/DEVELOPMENT.md`）

## Dev / Run / Test（开发者使用指南）
```bash
# 初始化/更新 submodule（会修改工作区；谨慎执行）
just sdk-submodule-update              # 依据：justfile:sdk-submodule-update

# 手动更新（替代方案）
git submodule update --init --recursive vendor/crystalith-sdks   # 依据：scripts 提示与 .gitmodules
```

高副作用命令（会 commit/tag/push；谨慎执行）：
- `just sdk-release X.Y.Z`（入口：`justfile:sdk-release`；实现：`scripts/sdk_release.sh`）
- submodule 发布约定详见：`vendor/crystalith-sdks/DEVELOPMENT.md`

## Config / Observability（配置与可观测性）
- submodule 定义：`.gitmodules`
- release 预检与一致性检查：
  - `justfile:sdk-release-preflight`（检查 dirty tree、submodule 状态、指针是否提交等）
  - `justfile:sdk-version-check`（版本一致性）

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 明确“哪些东西应该进 vendor / 哪些不应该”并写进 docs（动机：避免滥用；收益：更可控；风险：需要达成共识；方案：以当前 `.gitmodules` 与 SDK 生成链路为例写清楚）。
  - 为 submodule 更新流程补充更明显的提示（动机：减少“生成了但忘记提交指针”；收益：更少失败；风险：流程更严格；方案：在 `justfile` 的 sdk 相关任务输出中强调（见 `justfile:sdk-release-preflight` 现有校验风格）。
- 中期（1–2 月）
  - 将 submodule 的更新与变更说明（changelog）更紧密关联（动机：可追溯；收益：发布更稳；风险：维护成本；方案：与 openspec change 工作区联动，在 release 时记录关联 change id）。
  - 为 submodule 提供定期升级/对齐策略（动机：减少漂移；收益：更少兼容问题；风险：需要节奏；方案：基于 `vendor/crystalith-sdks/DEVELOPMENT.md` 的发布约定制定频率与回滚策略）。
- 长期（季度+）
  - 建立供应链安全与审计策略（动机：发布安全；收益：更可靠；风险：需要工具/流程；方案：先从记录 submodule SHA、生成器版本（`sdk/configs/fern/generators.yml`）与 OpenAPI checksum 开始，逐步增强）。

## Assumptions / TODO to Verify（已知未知）
- `just sdk-submodule-update` 会在某些情况下调整 submodule 的 push URL（`justfile:sdk-submodule-update` 中包含 `git remote set-url --push ...` 逻辑）；在你的环境中是否期望该行为，需要确认。
- `vendor/crystalith-sdks` 的 CI/发布工作流细节（Secrets、环境等）：以 `vendor/crystalith-sdks/DEVELOPMENT.md` 为准，并在 submodule 仓库 `.github/workflows/` 中核对。
