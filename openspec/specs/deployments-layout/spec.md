# deployments-layout Specification

## Purpose
定义仓库部署清单的目录结构与“一键启动”入口，避免重复配置漂移，并提供可选离线（Ollama）体验路径。

## Related specs

- `GLOSSARY.md`
- `deployment/spec.md`
- `config-management/spec.md`
- `ci-cd/spec.md`

## Requirements

### Requirement: Canonical deployments directory
系统 MUST 在仓库根目录提供 `deployments/`，并在其中按场景组织部署清单（至少包含 `deployments/prod/`）。
仓库 MUST 存在 `deployments/` 目录，且 MUST 存在 `deployments/prod/` 作为生产部署入口。

### Requirement: Production stack is runnable from deployments/prod
系统 SHALL 在 `deployments/prod/` 提供可直接运行的 Compose 文件与必要的示例配置，使用户可通过单条命令启动完整栈。

### Requirement: Optional offline Ollama profile
系统 SHALL 在 `deployments/prod/docker-compose.yml` 提供可选 `ollama` profile，用于离线体验路径。
离线启动路径 SHOULD 支持单行命令完成（通过命令前缀设置必要 env vars：`OLLAMA_HOST=http://ollama:11434`、`CRYSTALITH_DEFAULT_CHAT_MODEL=qwen-local`、`CRYSTALITH_DEFAULT_EMBEDDING_MODEL=bge-m3-local`），且文档 SHOULD 提示首次运行需要执行 `ollama pull` 下载模型。

### Requirement: Deployment entry is discoverable
系统 SHALL 在 `deployments/README.md` 记录可用部署场景与对应启动命令，以便用户可快速找到“一键启动”的入口。
`deployments/README.md` SHOULD 包含 `deployments/prod/` 的启动命令与最小配置说明。
