## 1. 配置模型与示例（YAML 单一真相）

- [x] 1.1 更新 `backend/py/src/crystalith/shared/config/models.py`：为“候选端点/自动适配”新增字段（database/cache/vector/search/optional services），并补齐 schema 描述。
- [x] 1.2 更新 `config/app.yaml`：将敏感项从 `${{ env.* }}` 收敛为 `${{ secrets.* }}`，并补齐候选端点示例（compose service name + host dev 端口）。
- [x] 1.3 更新 `config/secrets.yaml.example`：补齐需要的 secrets key，并在注释中强调不提交 `config/secrets.yaml`。
- [x] 1.4 运行 `cd backend/py && just config-schema` 生成并校验 `config/app.schema.gen.json`（确保 `config/app.yaml` schema 校验通过）。

## 2. 配置加载器：移除业务 env overrides + 自动发现 secrets

- [x] 2.1 更新 `backend/py/src/crystalith/shared/config/manager.py`：实现 secrets 自动发现（优先 `CRYSTALITH_SECRETS_PATH`，否则 `<config_dir>/secrets.yaml`）。
- [x] 2.2 更新 `backend/py/src/crystalith/shared/config/manager.py`：移除/禁用 `_apply_env_overrides` 中对业务字段的覆盖逻辑（DATABASE_URL/REDIS_URL/OPENAI_API_KEY/OLLAMA_HOST/SEARXNG 等），并确保仅保留 config/secrets 定位入口。
- [x] 2.3 在配置加载阶段实现候选端点解析与选择：按优先级探测可达端点并写回最终 settings（database/vector/cache/ollama 等启动时定案项）。
- [x] 2.4 为候选端点与回退策略补齐错误信息与恢复提示（保证错误可理解、可定位）。

## 3. 运行时行为：懒加载与可选升级

- [x] 3.1 更新 SearXNG 搜索实现：支持从 YAML 候选端点懒加载并锁定可用端点（可选依赖晚启动可恢复）。
- [x] 3.2 更新 cache provider：支持 `cache.provider=auto`（或等价机制），在 Redis 可达时升级为 redis，不可达时保持 memory。
- [x] 3.3 更新 `/health/dependencies` 可选依赖诊断：输出实际选用端点（若已锁定）与清晰的 recovery_hint。
- [x] 3.4 将 `AUTO_DB_INIT` 行为迁入 YAML（并更新启动逻辑读取 settings 而非 env）。

## 4. 部署清单收敛：overlays 只起服务，不注入业务 env

- [x] 4.1 更新 `deployments/prod/docker-compose.storage.yml`：移除对 `api.environment` 的 DATABASE_URL/CHROMA_HOST/CHROMA_PORT 注入，仅保留依赖服务与健康检查。
- [x] 4.2 更新 `deployments/prod/docker-compose.redis.yml`：移除对 `api.environment` 的 CACHE_PROVIDER/REDIS_URL 注入。
- [x] 4.3 更新 `deployments/prod/docker-compose.searxng.yml`：移除对 `api.environment` 的 searxng 相关业务变量注入（如存在）。
- [x] 4.4 更新 `deployments/prod/docker-compose.ollama.yml`：移除对 `api.environment` 的 OLLAMA_HOST 注入（如存在）。
- [x] 4.5 更新 `deployments/prod/docker-compose.yml`：尽量移除 `api` 的业务 env，仅保留必要的运行环境参数；确保 `config/app.yaml` 挂载路径稳定。

## 5. 文档与迁移说明

- [x] 5.1 更新 `.env.example`：仅保留部署/构建静态参数，删除业务参数项，并引导用户使用 `config/app.yaml` + `config/secrets.yaml`。
- [x] 5.2 新增迁移文档（`deployments/_NOTE.md` 或根目录 `_NOTE.md`）：提供从旧 `.env`/env overrides 迁移到 YAML + secrets 的对照表与步骤。
- [x] 5.3 更新 `docs/content/configuration.md`、`docs/content/deployment.md`、`deployments/README.md`：统一以 YAML 为中心的配置方式与验收步骤。

## 6. 测试与验收

- [x] 6.1 新增/更新 pytest：覆盖 secrets 自动发现、业务 env overrides 不生效、候选端点选择与回退逻辑。
- [x] 6.2 运行 `cd backend/py && just test`。
- [ ] 6.3 运行 compose smoke：`just composition-smoke`（至少覆盖 core-only 与 overlays 场景）。
- [ ] 6.4 人工验收：`curl -fsS http://localhost:${CL_WEB_PORT:-8080}/health` 与 `/health/dependencies` 输出符合预期。

## 执行记录

- 2026-03-05：`cd backend/py && just config-schema`（schema 生成/校验）
- 2026-03-05：`cd backend/py && just test`（471 passed，coverage 85.00%）
- 2026-03-05：`just composition-smoke`（本环境无法连接 Docker daemon；需在具备 Docker 的机器上执行）
