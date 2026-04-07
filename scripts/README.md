# scripts（运行与维护脚本）

> TL;DR：本目录包含支撑 `just` 统一入口的脚本：运行 profile 编排、Docker Compose wrapper、配置初始化、前端依赖准备、SDK 生成/发布、以及一些 smoke/等待工具。多数脚本会产生副作用（写文件、启动容器、执行 git 操作）；在自动化/生产使用前应先阅读脚本头部与实现。

## Scope（责任边界）

### 做什么
- 统一运行编排：
  - `scripts/orchestrate.sh`：`just up/down/status/logs` 的核心实现（入口：`justfile:up/down/status/logs`）。
  - `scripts/dev_compose.sh`：docker compose wrapper（被 orchestrate 调用；读取 `deployments/**` compose 文件）。
- 配置初始化（写文件）：
  - `scripts/init_config.sh`：从 shell env “填空式”写入 `.env` 与 `config/secret.env`（入口：`justfile:upsert-env-configs`）。
- 前端准备（会触发 submodule/pnpm install）：
  - `scripts/ensure_rivu_submodule.sh`：初始化 `frontend/web/vendor/rivu` submodule（定义：`.gitmodules`）。
  - `scripts/ensure_frontend_web_ready.sh`：确保 rivu submodule + 依赖安装（被 `frontend/web/package.json` 的 `predev/prebuild/pretest/...` 调用）。
- SDK 生成与发布（高副作用）：
  - `scripts/sdk_gen.sh`：生成 SDK（读 `frontend/web/openapi.gen.json`，写 `vendor/crystalith-sdks/*`）。
  - `scripts/sdk_release.sh`：一键 release（commit/tag/push，入口：`justfile:sdk-release`）。
- 工具脚本：
  - `scripts/wait_ready.sh`：等待 TCP/HTTP/SearXNG ready（被 `scripts/orchestrate.sh` 使用）。
  - `scripts/cleanup.sh`：清理旧工作流残留（入口：`justfile:cleanup`）。
  - `scripts/composition_smoke.sh`：compose 冒烟检查（入口：`justfile:composition-smoke`）。
  - `scripts/openspec/*.py`：openspec 维护脚本（会重命名/重写文件；见 `scripts/openspec/renumber_changes.py` 等）。

### 不做什么
- 不包含业务逻辑实现（业务逻辑在 `backend/` / `frontend/`）。
- 不替代 `deployments/` 与 `dockers/`（脚本只是编排/调用它们）。

## Integration（与项目的关系）

### 关键调用链
~~~text
just (root justfile)
  +--> scripts/orchestrate.sh (profiles)
         +--> scripts/dev_compose.sh (compose wrapper) --> deployments/**/docker-compose*.yml --> dockers/*
         +--> overmind start -f Procfile (local/hybrid app processes)
  +--> scripts/init_config.sh (writes .env + config/secret.env)
  +--> scripts/sdk_gen.sh / scripts/sdk_release.sh (writes/commits/tags)
~~~

### 与配置/部署的关系
- `.env` 作为 orchestrate 的 profile/参数输入（`.env.example` + `scripts/orchestrate.sh:_source_env_file`）。
- 业务配置 SSOT 在 `config/app.yaml`（迁移说明：`deployments/_NOTE.md`）。
- compose wrapper 默认会移除 HTTP(S)_PROXY 环境变量（除非显式保留）：`scripts/dev_compose.sh`（`CRYSTALITH_KEEP_PROXY_ENV`）。

## Core Logic（核心概念与核心数据流）

### 术语表
- profile：`local/hybrid/docker/full`（`scripts/orchestrate.sh` + `.env.example`）。
- overlays：一组可选服务文件名（`HYBRID_SERVICES/DOCKER_SERVICES/FULL_SERVICES`，模板：`.env.example`）。
- mode：`deps`（dev 依赖） vs `prod`（部署） （`scripts/dev_compose.sh`）。
- “safe upsert”：只填空不覆盖已有值（`scripts/init_config.sh` 的注释与实现）。

### 主流程（运行）
1. `just up`（根目录 `justfile:up`）调用 `scripts/orchestrate.sh up [profile]`。
2. `scripts/orchestrate.sh`：
   - `local`：`overmind start -f Procfile`（证据：`scripts/orchestrate.sh` + `Procfile`）。
   - `hybrid`：`scripts/dev_compose.sh deps up` 起依赖 → `scripts/wait_ready.sh` 等待 → `overmind start`。
   - `docker/full`：`scripts/dev_compose.sh prod up` 起应用与 overlays。
3. 前端脚本通常会先运行 `scripts/ensure_frontend_web_ready.sh`（由 `frontend/web/package.json` 的 `pre*` 脚本触发）。

### 重要边界条件
- `scripts/init_config.sh` 会写 `.env` 与 `config/secret.env`（带 `sed -i` / `cp` / `touch`），并且“已有非空值不覆盖”（脚本注释 + `_set_env_var/_set_secret_env`）。
- `scripts/sdk_release.sh` 会进行 git commit/tag/push（脚本实现；高副作用）。
- `scripts/cleanup.sh --apply` 会删除容器/volume/目录（脚本注释；高副作用）。

## Dev / Run / Test（开发者使用指南）
```bash
# repo root：统一运行入口
just up [profile]                      # 依据：justfile + scripts/orchestrate.sh
just down [profile]
just status [profile]
just logs [profile]
```

```bash
# repo root：初始化本地配置（会写文件；谨慎执行）
just upsert-env-configs                # 依据：justfile:upsert-env-configs + scripts/init_config.sh
```

```bash
# repo root：清理旧工作流残留（--apply 会删除资源；谨慎执行）
just cleanup
just cleanup --apply                   # 依据：justfile:cleanup + scripts/cleanup.sh
```

```bash
# repo root：SDK（高副作用：生成/提交/打 tag）
just sdk-gen-python                    # 依据：justfile:sdk-gen-python + scripts/sdk_gen.sh
just sdk-release X.Y.Z                 # 依据：justfile:sdk-release + scripts/sdk_release.sh
```

## Config / Observability（配置与可观测性）
- `scripts/orchestrate.sh` 会读取 `.env` 或 `.env.example` 并 export（`_source_env_file`）。
- 可调参数（来源：`.env.example` + 脚本头注释）：
  - overlays：`HYBRID_SERVICES/DOCKER_SERVICES/FULL_SERVICES`
  - 镜像/镜像源：`APT_MIRROR/UV_INDEX_URL/NPM_REGISTRY`（`scripts/dev_compose.sh` 会注入到构建环境）
  - proxy 保留：`CRYSTALITH_KEEP_PROXY_ENV`
  - dev deps 端口：`CL_DEPS_*`（被 `scripts/orchestrate.sh:wait_for_deps` 使用）

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 对高副作用脚本补充统一“dry-run/确认提示”（动机：减少误操作；收益：更安全；风险：实现成本；方案：从 `scripts/cleanup.sh` 的 dry-run 模式抽象出一致模式，先覆盖 `sdk_release` 等）。
  - 为 orchestrate 的常见失败提供更具体的提示（动机：新手排障；收益：更快自助；风险：脚本变长；方案：围绕 `scripts/wait_ready.sh` 的失败点输出更明确建议）。
- 中期（1–2 月）
  - 引入脚本静态检查（动机：减少 bash 细节 bug；收益：更稳；风险：CI 增量；方案：在不引入新工具前提下，至少在 repo 约定中要求 `set -euo pipefail`（多数脚本已采用）并补齐关键脚本的 shellcheck 兼容写法）。
  - 统一日志前缀与输出结构（动机：排障；收益：更好 grep；风险：改动较广；方案：沿用 `scripts/orchestrate.sh` 的 `info/warn/error` 形式逐步统一）。
- 长期（季度+）
  - 将 scripts 的“可用命令/参数矩阵”自动生成到 docs（动机：文档不漂移；收益：更少手工维护；风险：需要生成器；方案：复用 `backend/py/scripts/gen_docs.py` 的思路，为 `.env.example`/`justfile`/scripts 生成参考页）。

## Assumptions / TODO to Verify（已知未知）
- `scripts/composition_smoke.sh` 覆盖了哪些部署组合：阅读脚本实现并与 `deployments/` overlays 对照。
- `sdk_release` 是否要求特定 git 分支/clean tree：脚本里强约束 `main` 与 clean working tree（`scripts/sdk_release.sh`），但是否还有团队约定需要补进 docs（可参考 `vendor/crystalith-sdks/DEVELOPMENT.md`）。
