## ADDED Requirements

### Requirement: Production image dependency profiles
系统 MUST 允许生产 Docker 镜像在运行外部 Chroma（HTTP）模式时不安装 embedded Chroma 的 Python 依赖（`chromadb` 及其相关体积较大的依赖），以降低镜像体积并减少维护风险。

#### Scenario: 外部 Chroma 模式构建不安装 chromadb
- **WHEN** 生产 docker-compose 配置使用外部 Chroma 服务（例如 `CHROMA_HOST=chromadb`）
- **THEN** 后端镜像构建阶段通过 uv 的安装选项跳过 `chromadb` 的安装
- **AND** 最终镜像无需通过“安装后卸载依赖清单”的方式瘦身
