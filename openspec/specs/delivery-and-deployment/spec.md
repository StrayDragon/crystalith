# delivery-and-deployment Specification

## Purpose

定义部署与交付最小闭环：部署目录约束、生产 compose 入口、离线 profile、镜像构建基线与文档可发现性。

## Non-goals

- 不定义业务 API 语义
- 不定义前端交互行为

## Requirements

### Requirement: Deployments directory is canonical
仓库 MUST 以 `deployments/` 作为部署清单根目录，并包含 `deployments/prod/`。

### Requirement: Production stack is runnable from prod manifest
`deployments/prod` MUST 提供可一键启动的生产栈配置。

### Requirement: Stateful services persist data
有状态服务 MUST 使用 volume 持久化，容器重建后数据不丢失。

### Requirement: Runtime images are optimized and non-root
生产镜像 MUST 使用多阶段构建且以非 root 用户运行。

### Requirement: Optional offline Ollama profile is supported
生产 compose SHOULD 提供可选 `ollama` profile 供离线路径使用。

### Requirement: Deployment entrypoints are documented
`deployments/README.md` MUST 记录主要部署场景与启动命令。
