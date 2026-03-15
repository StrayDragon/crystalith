# 运维手册（自托管）

本文档聚焦自托管 Crystalith 的日常运维能力：诊断、备份/恢复，以及常见故障快速处理手册。

## 安全

- 默认情况下，API **无认证**。在将服务栈暴露到公网前，请启用 `app.auth`（或添加反向代理认证层）。
- 当 `app.auth.enabled=true` 时，所有 `/v1/**` 端点需要 API 密钥（Bearer token）。`/health` 和 `/health/dependencies` 仍对探针保持匿名访问。

## 诊断

- UI：使用 Workspace 的 **Health / Diagnostics** 对话框（顶部按钮）。
- API：
  - `GET /health`
  - `GET /health/dependencies`（核心服务 + 可选服务，含 `recovery_hint`）

## 备份 / 恢复 / 迁移

Crystalith 部署通常为 **核心 + 可选叠加层**。最小备份集取决于你使用的存储模式。

### 仅核心（本地 SQLite + 嵌入式向量存储）

在默认核心 compose 中，宿主机 `./data` 目录挂载到 API 容器的 `/app/data`。

最小备份集：
- `config/app.yaml`（配置）
- `data/app.db`（SQLite 数据库）
- 向量存储数据（取决于配置）：
  - 嵌入式 Chroma：`data/chroma/`
  - SQLite 向量：`data/vectors.db`

可选（建议备份）：
- `data/output/`（生成产物/预览）
- `config/secrets.yaml`（若存在；切勿提交）或 `CRYSTALITH_SECRETS_PATH` 引用的任意路径

恢复步骤（仅核心）：
1. 停止服务栈：`docker compose ... down`
2. 将上述文件恢复到目标主机。
3. 启动服务栈：`docker compose ... up -d`
4. 验证：
   - `curl -fsS http://localhost:${CL_WEB_PORT:-8080}/health`
   - 打开 UI 确认 notebooks/sources 存在。

### storage overlay（Postgres + Chroma server）

使用 `deployments/prod/docker-compose.storage.yml` 时，持久化数据移至 Docker volumes：
- Postgres：`pgdata`
- Chroma：`chromadata`

最小备份集（storage overlay）：
- `config/app.yaml`
- Docker volumes：`pgdata`、`chromadata`

提示：volume 名称以 **compose 项目** 为作用域。使用 `docker volume ls | rg crystalith` 确认宿主机上的确切名称。

### redis overlay

若启用，Redis 数据存储在 `redisdata` volume 中。仅在需要缓存持久化时备份（多数场景可跳过）。

### ollama overlay

若启用，下载的模型存放在 `ollamadata` volume 中。若希望迁移后避免重新下载模型，请备份该 volume。

## 快速处理手册（常见故障）

### UI 无法访问

症状：
- 浏览器无法打开 UI，或出现反向代理错误。

检查：
- `docker compose ps`
- `curl -v http://localhost:${CL_WEB_PORT:-8080}/health`

处理：
- 端口冲突：在 `.env` 中修改 `CL_WEB_PORT`。
- 容器未运行：查看日志（`docker compose logs web api`）。

### UI 可打开但后端显示「disconnected」

检查：
- `curl -fsS http://localhost:${CL_WEB_PORT:-8080}/health`
- 打开 Workspace 的 **Health / Diagnostics**，查看 `core.backend`。

处理：
- API 容器不健康：查看 `docker compose logs api`。
- 环境/配置错误：确认 `config/app.yaml` 已挂载且有效。

### 可选服务降级 / 禁用

检查：
- UI 诊断面板显示 `optional.*` 状态及 `recovery_hint`。
- `curl -fsS http://localhost:${CL_WEB_PORT:-8080}/health/dependencies | python3 -m json.tool | head -120`

处理：
- 若计划使用 overlay，确保已启动（compose `-f docker-compose.<overlay>.yml`）。
- 若使用外部服务，验证 `config/app.yaml`：
  - Postgres：`database.url` / `database.url_candidates`（+ 密码相关 secrets）
  - Chroma：`vector_storage.chroma.host/port` 或 `vector_storage.chroma.endpoint_candidates`
  - Redis：`cache.provider` + `cache.redis_url` / `cache.redis_url_candidates`
  - Ollama：`optional_services.ollama.endpoint_candidates`（以及 ollama 模型提供方 host）
  - SearXNG：`search.searxng.host` / `search.searxng.endpoint_candidates`

### 「Source from URL」失败（SSRF 防护）

症状：
- Fetch 模式拒绝某 URL（常见于私有 IP、localhost 或 metadata 目标）。

处理：
- 使用公开的 `http(s)` URL，或在 `config/app.yaml` 中显式允许受控主机：
  - `source_ingestion.url_fetch.security.allowlist_hosts`
  - `source_ingestion.url_fetch.security.allowlist_domains`
  - `source_ingestion.url_fetch.security.allowlist_cidrs`

安全说明：保持 allowlist 尽量收紧；除非理解其权衡，否则避免启用 `allowlist_only`。

### 「Source from URL」抓取失败（缺少 extractors / 策略）

症状：
- Fetch 模式返回 `503 OPTIONAL_SERVICE_UNAVAILABLE`，`recovery_hint` 提及 `extractor-*` 插件。

处理：
- 安装官方 extractor 包：`pip install 'crystalith[official-extractors]'`（或 `crystalith[official-full]`）。
- 确认插件未被配置禁用：
  - `plugins.disabled`（黑名单）
  - `plugins.enabled`（白名单；若设置，所需插件 id 必须包含在内）
- 若使用 notebook 级自定义策略，至少启用一个 extractor（或将 notebook 改回 `inherit_global`）。

### 上传 PDF/HTML/音频/视频失败（缺少 parsers）

症状：
- 上传返回 `415 PARSER_PLUGIN_REQUIRED`，并包含 `details.required_plugin_id`（如 `parser-pdf`）。

处理：
- 安装官方 parser 包：`pip install 'crystalith[official-parsers]'`（或 `crystalith[official-full]`）。
- 确认插件未被 `plugins.*` 配置禁用。

### Source connectors 缺失 / 为空

症状：
- UI 中 connectors 列表为空。
- `GET /v1/notebooks/{notebook_id}/source-connectors` 返回空的 `connectors` 列表。
- 为 `connector-obsidian` / `connector-local-directory` 创建 binding 时返回 `404 Source connector not found`。

处理：
- 安装 connector 插件：
  - `pip install 'crystalith[official-connectors]'`（或 `crystalith[official-full]`）
  - 开发环境：`cd backend/py && uv sync --extra official-connectors`
- 确认插件未被禁用：
  - `plugins.disabled`（黑名单）
  - `plugins.enabled`（白名单；若设置，所需插件 id 必须包含在内）
- Docker Compose：在 `.env` 中设置 `CRYSTALITH_BACKEND_EXTRAS="official-connectors"`（或 `official-full`）并重建 `api`。
- 文件系统说明：Obsidian/Local Directory connectors 从后端文件系统读取。在容器中，需将目标目录挂载到 `api` 并使用容器内路径。

## 基准测试

### Source connector snapshot + sync_check diff

仓库内有一个小型基准脚本，用于 connector snapshot 枚举与 sync_check diff：

```bash
cd backend/py
uv run python scripts/source_connectors_bench.py --connector obsidian --files 1000 --updates 50 --missing 50 --added 50 --repeats 5
uv run python scripts/source_connectors_bench.py --connector local-directory --files 1000 --updates 50 --missing 50 --added 50 --repeats 5
```

输出包括：
- `snapshot_ms`：snapshot 枚举（含 Markdown 的 frontmatter 采样）
- `sync_check_diff_ms`：纯 diff（`base_snapshot` vs `current_snapshot`）

脚本按 `--repeats` 输出 p50/p95/p99 分位数。可用于修改 connector 枚举逻辑时的回归防护。

示例基线（2026-03-14，`--repeats 5`，1000 个 markdown 文件）：

```text
obsidian:
  snapshot_ms p50 ~280.909ms, sync_check_diff_ms p50 ~0.253ms

local-directory:
  snapshot_ms p50 ~328.951ms, sync_check_diff_ms p50 ~0.706ms
```
