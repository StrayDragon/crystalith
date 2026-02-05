## 1. 后端 Dockerfile 优化
- [ ] 1.1 多阶段构建（builder → runtime），最小化镜像体积
- [ ] 1.2 非 root 用户运行
- [ ] 1.3 健康检查指令（HEALTHCHECK）
- [ ] 1.4 验证镜像构建成功且功能正常

## 2. 前端 Docker 配置
- [ ] 2.1 前端多阶段构建（build → nginx serve）
- [ ] 2.2 Nginx 配置（SPA 路由、gzip、缓存头）
- [ ] 2.3 验证前端容器正常服务

## 3. Docker Compose 生产配置
- [ ] 3.1 创建 docker-compose.prod.yml
- [ ] 3.2 后端服务配置（健康检查、restart: unless-stopped、资源限制）
- [ ] 3.3 前端服务配置
- [ ] 3.4 PostgreSQL 服务配置（持久化卷、初始化脚本）
- [ ] 3.5 Redis 服务配置（可选，用于缓存）
- [ ] 3.6 ChromaDB 服务配置（持久化卷）
- [ ] 3.7 网络隔离（frontend → backend → database）

## 4. 配置和 Secrets 管理
- [ ] 4.1 创建 .env.example 模板（所有必要的环境变量）
- [ ] 4.2 后端支持从环境变量读取配置（覆盖 app.yaml）
- [ ] 4.3 Docker secrets 集成（API keys 等敏感信息）

## 5. 部署文档
- [ ] 5.1 编写快速部署指南（docker compose up）
- [ ] 5.2 编写配置说明（环境变量、外部服务）
- [ ] 5.3 编写备份和恢复指南

## 6. 验证
- [ ] 6.1 从零开始 docker compose up 完成完整部署
- [ ] 6.2 验证数据持久化（重启容器后数据不丢失）
- [ ] 6.3 验证健康检查正确响应
- [ ] 6.4 验证在单机 4GB 内存环境下可正常运行
