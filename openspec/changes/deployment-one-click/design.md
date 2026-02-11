## Context

为了 public 发布与外部用户快速试用，部署路径需要做到“默认安全、入口清晰、一步跑起来”。目前仓库已具备生产 Compose（`docker-compose.prod.yml`）与 Dockerfiles（`dockers/**`），以及部署文档（`docs/deployment.md`），但部署相关入口分散、缺少统一目录约定；同时 `config/app.yaml` 当前包含明显的私有/敏感默认值（例如明文 API key 与内网 base_url），这对开源发布是高风险项。

现状与约束：

- 生产 Compose 依赖 `./config` 目录挂载到容器中（`CRYSTALITH_CONFIG_PATH=/app/config/app.yaml`）。
- 后端配置系统已支持：
  - YAML anchors
  - `${{ env.* }}` / `${{ secrets.* }}` 插值
  - 部分环境变量覆盖（例如 `DATABASE_URL`、`CHROMA_HOST` 等）
  - `CRYSTALITH_SECRETS_PATH`（文件或目录）读取 secrets
- 需要在不牺牲“一条命令启动”的前提下，提升部署清单的可发现性与可维护性，并确保仓库内不提交真实 secrets。

## Goals / Non-Goals

**Goals:**

- 在仓库根目录新增 `deployments/`，作为部署清单的统一入口（至少提供 `deployments/prod/`）。
- 提供 `deployments/prod/docker-compose.yml` 作为主入口，并保留根目录 `docker-compose.prod.yml` 兼容入口（避免破坏现有文档/习惯）。
- 明确与固化“开源安全默认”：仓库内示例配置不包含真实 key/私有地址；推荐通过 env/secrets 注入敏感信息。
- 将部署文档与配置模板对齐（`.env.example`、配置说明、secrets 用法），降低外部用户上手成本。

**Non-Goals:**

- 不在本变更中引入 K8s/Helm/Terraform 等云厂商特定部署。
- 不在本变更中建立完整生产运维体系（监控/告警/备份策略可后续拆分）。
- 不强制迁移所有 Dockerfile 位置；优先保证部署入口清晰与行为稳定。

## Decisions

### 1) 部署清单入口：`deployments/prod/docker-compose.yml` + 根目录兼容文件

**Decision:**

- `deployments/prod/docker-compose.yml` 作为生产部署的“主入口”文件。
- 根目录继续保留 `docker-compose.prod.yml` 作为兼容入口，并由 `deployments/prod/docker-compose.yml` **生成**（保持内容一致，避免漂移）。

**Rationale:** 既满足“部署集中管理”的长期诉求，又避免一次性破坏现有入口与文档链接。

**Alternatives:**

- 仅新增 `deployments/` 而不引入主入口文件：可行但收益有限，仍然分散。
- 直接移动并删除根目录 compose：破坏性较强，外部用户与历史文档成本高。

### 2) Dockerfiles 与 nginx 配置：优先保持现有 `dockers/**`，以 deployments 作为“编排层”

**Decision:** 初期不强制移动 `dockers/**`；`deployments/prod/docker-compose.yml` 可以继续引用现有 dockerfile 路径与 nginx 配置。若后续需要把部署清单完全自包含，再单独迁移。

**Rationale:** 降低改动半径与风险，把主要精力放在入口、模板与安全默认上。

### 3) 开源安全默认：示例配置全部使用 env/secrets 或占位符

**Decision:**

- 更新 `config/app.yaml`：移除真实密钥与私有地址，改为 `${{ env.* }}` / `${{ secrets.* }}` 或明显占位符。
- 在部署文档中明确：
  - `.env` 用于 Compose 注入（如 `OPENAI_API_KEY`、`DATABASE_URL`）
  - `CRYSTALITH_SECRETS_PATH` 支持文件/目录两种 secrets 载入方式

**Rationale:** 开源仓库的“默认配置”必须可安全分发；敏感信息必须来自运行时注入。

**Alternatives:**

- 将真实配置放入 git ignored 文件：对本地开发更友好，但会让外部用户缺少可参考模板；因此保留示例文件更合适。

### 4) 离线替代路径：可选 Ollama profile

**Decision:**

- 在 `deployments/prod/docker-compose.yml` 中提供可选的 `ollama` profile：
  - 启用 profile 时启动 `ollama` 服务（容器内提供 `http://ollama:11434`）。
  - 通过 env overrides（`OLLAMA_HOST`、`CRYSTALITH_DEFAULT_CHAT_MODEL`、`CRYSTALITH_DEFAULT_EMBEDDING_MODEL`）切换为本地模型默认值（固定为现有配置中的 `qwen-local` 与 `bge-m3-local`）。
- 文档提供一条可复制的一行命令用于离线启动（允许通过命令前缀设置 env vars）。
- 不在启动流程中自动执行 `ollama pull`；仅在文档中提示首次运行需要预拉取模型并给出命令。

**Rationale:**

- 默认路径保持 OpenAI（最低摩擦）；同时为“无外网/不想配置 key”的用户提供离线体验入口。
- 使用 Compose profile 能在不污染默认启动路径的情况下添加额外组件。

**Alternatives:**

- 仅文档化“用户自行安装 Ollama 并设置 `OLLAMA_HOST`”：更轻，但不是真正的“一键离线启动”。
- 另起 `deployments/local/` 专门用于离线体验：结构更清晰，但超出当前最小变更范围（可后续扩展）。

## Risks / Trade-offs

- [根目录 compose 与 deployments compose 漂移] → 提供同步脚本或明确单一来源策略（例如只编辑 `deployments/prod/docker-compose.yml`，根目录文件由脚本生成）。
- [示例配置改为 env/secrets 后“默认启动不工作”] → 文档中给出最小可运行路径（默认 OpenAI，只要求 `OPENAI_API_KEY`；可选提供本地 Ollama 作为替代路径）。
- [部署目录结构调整影响现有用户] → 保留兼容入口；在文档中同时给出新旧命令并标注推荐方式。

## Migration Plan

1. 新增 `deployments/README.md` 与 `deployments/prod/docker-compose.yml`，并让其可一键启动。
2. 让根目录 `docker-compose.prod.yml` 与主入口语义保持一致（复制/生成策略在实现时确定）。
3. 更新 `docs/deployment.md` 与 `.env.example`，对齐新的入口路径与变量说明。
4. 清理 `config/app.yaml`：移除真实 secrets，改为 env/secrets/占位符，并确保 schema 校验仍可用。
5. 用 `docker compose` 进行端到端验证（build + up + healthcheck）。

## Open Questions

- （已选）“一键启动”的默认路径：OpenAI（用户提供 `OPENAI_API_KEY` 即可启动；embedding 也走 OpenAI）。
- （已选）根目录 `docker-compose.prod.yml` 同步策略：从 `deployments/prod/docker-compose.yml` 脚本生成（以 deployments/prod 为单一来源，清理其他重复配置）。
- 是否需要 `deployments/local/`（更贴近开发）与 `deployments/test/`（配合 CI/E2E）目录？若需要，目录边界与内容应如何定义？
- （已选）Ollama profile 声明持久化 volume（模型缓存）：通过专用 volume 持久化 `/root/.ollama`，避免每次重建都需要重新拉取模型。
- （仅文档提示）Ollama profile 的资源配额：不在 compose 中强制限制（不同主机差异大），仅在文档中提示最低内存/磁盘与首次 pull 的注意事项。
