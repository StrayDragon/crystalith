## Why

为了 public 发布与外部用户快速试用，部署路径需要做到“默认安全、路径清晰、一步跑起来”；目前部署相关内容分散（`docker-compose.prod.yml`、`dockers/**`、`docs/deployment.md`、`config/app.yaml`），且 `config/app.yaml` 仍包含明显的本地/私有默认值（包含敏感信息风险）。需要一次系统化整理，降低上手与维护成本，并确保开源发布安全。

## What Changes

- 整理部署入口与目录结构：
  - 在仓库顶层新增 `deployments/`，作为部署配置的单一入口（Compose、Dockerfile、nginx 配置、env 模板、脚本等）。
  - 明确区分本地试用与生产部署配置（例如 `deployments/local` / `deployments/prod`），并保持“一条命令启动”的体验。
- 强化一键部署体验（保持现有 Compose 能力基础上“可发现/可复制/可解释”）：
  - 对关键环境变量、profile（如 redis）、数据卷、健康检查等做一致性与文档化整理。
  - 为常见场景提供最小可用配置模板（`.env.example`、`config/app.example.yaml` / `config/app.yaml` 的安全默认）。
- 开源安全清理与配置最佳实践：
  - 将 `config/app.yaml` 中的敏感/私有配置改为 env/secrets 引用或示例值，并提供清晰的本地配置指引。
  - 明确 `CRYSTALITH_SECRETS_PATH`（文件/目录两种）在 Docker/本地的使用方式，避免把 secrets 误提交进仓库。

## Capabilities

### New Capabilities

- `deployments-layout`: 提供标准化的部署配置布局与脚本入口，使用户可以按场景（local/prod）一键启动并理解系统组件边界。

### Modified Capabilities

- `deployment`: 扩展/明确“一键部署”的仓库结构约束与配置策略（Compose/Dockerfile/Profiles/Healthcheck/Persistence 的可维护性要求）。
- `config-management`: 对齐当前实现的环境变量/secret 覆盖能力与开源安全约束（例如：哪些字段允许 env override，如何插值，如何加载 secrets）。

## Impact

- 部署相关文件：`docker-compose.prod.yml`、`dockers/**`、nginx 配置、`.env.example`、以及新增的 `deployments/**`（最终以 design 为准）。
- 配置：`config/app.yaml`（消除敏感默认值、引导通过 env/secrets 配置），必要时涉及 `config/schema.json` 的同步更新。
- 文档：`docs/deployment.md`（对齐新目录结构与最佳实践），以及 docs-site（若已引入）中的部署章节。
- 非目标：不在此变更中引入云厂商特定部署（K8s/Helm/Terraform 等）；不实现完整“发布到公网”的运维体系（监控/日志/备份策略可后续拆分）。
