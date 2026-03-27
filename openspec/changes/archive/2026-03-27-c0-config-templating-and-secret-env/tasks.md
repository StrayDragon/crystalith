# c0: Tasks — Config Templating + secret.env Consolidation

## 1. Backend: template rendering in config loader

- [x] 1.1 引入 Jinja2 配置模板渲染器（推荐 sandbox + StrictUndefined）
  - 渲染 `config/app.yaml` 与所有 overlays（逐文件渲染后再 YAML parse）
  - Verify: 为模板语法错误输出包含文件路径与行列信息

- [x] 1.2 实现 `.env` 解析并叠加到 `env` 命名空间
  - 规则：先读 `os.environ`，再用 `.env` 覆盖同名 key
  - `.env` 定位：当 config 位于 `<root>/config/app.yaml` 时读取 `<root>/.env`（否则以 config dir 为 anchor）
  - Verify: 单测覆盖 `.env` 覆盖系统 env 的优先级

- [x] 1.3 实现 `config/secret.env` 读取并提供 `secret` 命名空间
  - 读取与 `app.yaml` 同目录的 `secret.env`（dotenv 格式）
  - Verify: 缺失 `secret.*` 时启动失败并提示补全文件

- [x] 1.4 将 `ConfigManager` 加载链路调整为：render → parse → merge → schema validate → settings validate
  - 移除旧 env/secrets 字符串替换实现
  - Verify: `cd backend/py && just test`

## 2. Backend: 移除 secrets.yaml 体系（破坏性）

- [x] 2.1 移除 `config/secrets.yaml` / `config/secrets.yml` 作为运行时 secrets 入口
  - 更新 `ConfigManager._load_secrets` 与相关文档/提示语
  - Verify: secrets 仅从 `config/secret.env` 读取

- [x] 2.2 移除 legacy secrets path env var（及其文档/引用）
  - 更新 `backend/py/src/crystalith/shared/env.py`、`backend/py/src/crystalith/web/app.py` 等
  - Verify: `rg -n \"SECRETS_PATH\" -S .` 无残留

## 3. Repo config: 语法与文件布局迁移

- [x] 3.1 全量替换模板语法：旧 env/secrets 占位符 → `{{ env.* }}` / `{{ secret.* }}`
  - 同步更新 schema 描述文本与文档示例
  - Verify: `rg -n \"\\$\\{\\{\" -S .` 无残留（legacy placeholder 全部清理）

- [x] 3.2 将 repo 中已提交的本地 overlay 视为漂移源并清理
  - 备份到 `../`（例如 `../crystalith-config-backup-YYYYMMDD/`）
  - 从 git 移除：`config/app.local.yaml`、`config/app.*.local.yaml`（以及其他本机痕迹文件）
  - Verify: 新 clone 默认不会自动合并本地 overlay

- [x] 3.3 收敛 `config/` 到最小权威集合
  - 新增 `config/secret.env.example`
  - 删除/替换 `config/secrets.yaml.example`（迁移为 dotenv 示例）
  - （可选）将 `config/app.docker.yaml` 的差异合并回 `config/app.yaml`，减少默认文件数

## 4. Tooling: init/compose/orchestrator 对齐

- [x] 4.1 更新 `scripts/init_config.sh`：输出 `config/secret.env`（dotenv）替代 `config/secrets.yaml`
  - 保持“只填空不覆盖已有值”的策略
  - Verify: `just upsert-env-configs` 生成 `config/secret.env`

- [x] 4.2（可选）对齐 `scripts/orchestrate.sh` 的 `.env` 加载优先级与新规则
  - 若决定对齐：`.env` 覆盖进程已有同名 env（与 config 渲染一致）
  - Verify: local/hybrid profile 下 config 渲染与进程 env 心智模型一致

- [x] 4.3 更新 compose 文件与注释（如果仍引用 secrets.yaml）
  - Verify: `rg -n \"secrets\\.ya?ml\" deployments docs scripts` 无残留（除历史说明外）

## 5. Frontend: Nunjucks（按需）

- [x] 5.1 引入 Nunjucks 并实现最小渲染工具（用于预览/诊断）
  - 受支持子集：`{{ env.* }}`、`{{ secret.* }}`、`default()`
  - Verify: `cd frontend/web && pnpm test && pnpm typecheck`

## 6. Docs & verification

- [x] 6.1 更新文档：`docs/doc/deployment.md`、`docs/doc/configuration.md`、`deployments/_NOTE.md`
  - 新增 `secret.env` 的创建与示例
  - 明确 `.env` 的非 secret 约束与其对 `env` 命名空间的影响

- [x] 6.2 生成/校验
  - `cd backend/py && just config-schema`
  - `cd backend/py && just test`
  - `cd frontend/web && pnpm run format:check && pnpm run lint && pnpm test && pnpm typecheck`
  - `just check`

- [x] 6.3 手动启动验收
  - `just up local`（不启用 docker）
  - `just up hybrid`（docker deps + host app）
  - `just up docker`（compose 部署）
  - 检查：`/health`、`/health/dependencies`、关键 workflow 正常
