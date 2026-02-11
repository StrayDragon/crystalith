## 1. 部署入口与目录结构

- [ ] 1.1 新增 `deployments/README.md`：列出可用场景与对应一键启动命令
- [ ] 1.2 新增 `deployments/prod/docker-compose.yml`，并确保 `docker compose -f deployments/prod/docker-compose.yml up -d --build` 可启动完整栈
- [ ] 1.3 以 `deployments/prod/docker-compose.yml` 为单一来源：新增同步脚本生成根目录 `docker-compose.prod.yml`（兼容入口），并清理其他重复配置入口
- [ ] 1.4 增加一致性校验：在 CI 或本地检查中运行 `python scripts/deploy/sync_prod_compose.py --check`，确保根目录 compose 为最新生成结果

## 2. 部署文档与模板对齐

- [ ] 2.1 更新 `docs/deployment.md`：以 `deployments/prod/docker-compose.yml` 为主入口，并说明根目录兼容入口
- [ ] 2.2 复核并更新根目录 `.env.example`（作为唯一示例 env 模板），确保变量说明与 compose 一致（避免在 `deployments/**` 复制一份产生漂移）
- [ ] 2.3 文档补充 secrets 使用方式：`CRYSTALITH_SECRETS_PATH` 支持文件/目录两种形态（含 Docker secrets 示例）
- [ ] 2.4 文档补充离线替代路径：提供 `--profile ollama` 的一行启动命令（包含 env 前缀：`OLLAMA_HOST=http://ollama:11434`、`CRYSTALITH_DEFAULT_CHAT_MODEL=qwen-local`、`CRYSTALITH_DEFAULT_EMBEDDING_MODEL=bge-m3-local`），并提示首次运行需手动 `ollama pull`（如 `qwen2.5-coder:1.5b`、`bge-m3:567m`）

## 3. 开源安全默认（配置清理）

- [ ] 3.1 清理 `config/app.yaml`：移除真实密钥/私有地址，改为 `${{ env.* }}` / `${{ secrets.* }}` 或明显占位符（包括 provider base_url、search host、proxy 等）
- [ ] 3.2 将“一键启动默认 AI 路径”设为 OpenAI：默认 chat + embedding 均可在仅提供 `OPENAI_API_KEY` 时工作（不要求本地 Ollama）
- [ ] 3.3（可选）新增 `config/secrets.yaml.example` 与说明，避免用户误提交 secrets
- [ ] 3.4 校验配置加载行为与文档一致：环境变量覆盖（DATABASE_URL/CHROMA_HOST 等）与插值解析（env/secrets）可用

## 4. 端到端验证

- [ ] 4.1 使用两种入口分别验证：`docker-compose.prod.yml` 与 `deployments/prod/docker-compose.yml` 均可 build + up
- [ ] 4.2 验证 `GET /health` 返回 200，且 OpenAPI UI 可访问（通过 web 反代）
- [ ] 4.3 验证数据卷持久化：重建容器后 PostgreSQL/Chroma/uploads 数据不丢失
- [ ] 4.4 验证离线路径：使用 `--profile ollama` 启动并设置 `OLLAMA_HOST=http://ollama:11434`、`CRYSTALITH_DEFAULT_CHAT_MODEL=qwen-local`、`CRYSTALITH_DEFAULT_EMBEDDING_MODEL=bge-m3-local` 后，在未设置 `OPENAI_API_KEY` 的情况下可完成基础流程（至少 health + 触发一次最小 LLM 调用）
