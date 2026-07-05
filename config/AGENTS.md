# config（运行时配置）

> TL;DR：`config/app.yaml` 是 Crystalith 的运行时/业务配置 SSOT；`config/app.schema.gen.json` 是由后端生成的 JSON Schema（不要手改），用于编辑器校验（`config/app.yaml` 头部 `yaml-language-server: $schema=...`）。敏感信息放在 `config/secret.env`（示例：`config/secret.env.example`，并被 `.gitignore` 忽略）。

## Scope（责任边界）

### 做什么
- 承载运行时/业务配置（模型、存储、缓存、可选服务、抓取/抽取、安全等），SSOT：`config/app.yaml`（同文件顶部注释 + `deployments/_NOTE.md`）。
- 提供模板渲染能力（Jinja2）：`{{ env.KEY }}` / `{{ secret.KEY }}`（说明见 `config/app.yaml`；实现见 `backend/py/src/crystalith/shared/config/manager.py:ConfigManager`）。
- 提供生成的 schema：`config/app.schema.gen.json`（生成入口：`backend/py/justfile:config-schema`）。

### 不做什么
- 不存放 secrets 明文到 Git：`config/secret.env` 被 `.gitignore` 忽略（`.gitignore`）。
- 不把 `.env` 当业务配置：`.env` 主要用于 profile/compose/build 参数（`.env.example` + `scripts/orchestrate.sh`）。

### 典型使用场景
- 自定义模型/提供方：`config/app.yaml:models.*`、`config/app.yaml:providers.*`。
- 切换本地 SQLite ↔ Postgres：`config/app.yaml:database.url` / `database.url_candidates`（并配合 compose overlays：`deployments/prod/docker-compose.storage.yml`）。
- 启用 API Key 鉴权：`config/app.yaml:app.auth` + `backend/py/src/crystalith/web/auth.py:require_api_key`。

## Integration（与项目的关系）

### 上游依赖（输入）
- `.env`：提供模板输入（非敏感）与 orchestrator profile/端口等（`.env.example` + `scripts/orchestrate.sh`）。
- `config/secret.env`：提供 `{{ secret.* }}` 的值（示例：`config/secret.env.example`；读取实现：`backend/py/src/crystalith/shared/config/manager.py:_read_dotenv`）。

### 下游使用者（输出）
- 后端加载：`backend/py/src/crystalith/web/app.py:_load_settings` 使用 `ConfigManager` 读取并验证 `config/app.yaml`。
- Compose 部署：后端容器挂载 `config/`（只读）到 `/app/config`（`deployments/prod/docker-compose.yml:services.api.volumes`）。
- Docs 参考页生成：`backend/py/scripts/gen_docs.py` 读取 `config/app.schema.gen.json` 并生成 `docs/doc/reference/config-schema.gen.md`（导航入口：`docs/zensical.toml`）。

### 关键集成点
- 配置定位 env：
  - `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`（env SSOT：`backend/py/src/crystalith/shared/env.py`；说明：`deployments/_NOTE.md`）。
- overlay 发现规则：
  - `app.local.yaml` / `app.{env}.yaml` / `app.{env}.local.yaml`（`backend/py/src/crystalith/web/app.py:_discover_overlay_paths`，`env` 来自 `CRYSTALITH_ENV`）。

### 依赖关系图
~~~text
.os.environ + .env -----------+
                               \      (Jinja2 render)
config/secret.env -------------+--> config/app.yaml(template) --> Settings (Pydantic)
                                                      |
                                                      +--> config/app.schema.gen.json (generated)
                                                      |
                                                      +--> used by backend create_app + docs reference generation
~~~

## Core Logic（核心概念与核心数据流）

### 术语表
- SSOT：Single Source of Truth（`deployments/_NOTE.md` 明确把 `config/app.yaml` 作为 SSOT）。
- 模板渲染：`{{ env.KEY }}` / `{{ secret.KEY }}`（说明：`config/app.yaml`；实现：`backend/py/src/crystalith/shared/config/manager.py:ConfigManager`）。
- overlay：在 base config 上做 deep-merge 的附加 YAML（发现：`backend/py/src/crystalith/web/app.py:_discover_overlay_paths`；合并：`backend/py/src/crystalith/shared/config/manager.py:deep_merge`）。
- schema：`config/app.schema.gen.json`（生成：`backend/py/justfile:config-schema`）。

### 主流程（输入→处理→输出）
1. 读取模板上下文：
   - `env.*`：`os.environ` 被 `.env` 覆盖（`backend/py/src/crystalith/shared/config/manager.py:ConfigManager._template_context`）。
   - `secret.*`：读取 `config/secret.env`（同上 `_secret_env_path` + `_read_dotenv`）。
2. 渲染 config 模板：Jinja2 沙箱环境（`backend/py/src/crystalith/shared/config/manager.py:_render_env_for_source`）。
3. YAML 解析 + overlay deep-merge：`deep_merge` 的规则是“dict 递归合并，其它类型（含 list）覆盖”（`backend/py/src/crystalith/shared/config/manager.py:deep_merge` docstring）。
4. Pydantic 校验为 `Settings`：配置模型在 `backend/py/src/crystalith/shared/config/models.py`。
5. schema 生成/校验：
   - 生成：`cd backend/py && just config-schema`（`backend/py/justfile:config-schema`）
   - drift gate：`cd backend/py && just config-schema-check`（`backend/py/justfile:config-schema-check`）。

## 配置要点（从 `config/app.yaml` 可见的关键路径）
- `app.features.workspace_frontend_bundles_enabled`：是否允许 workspace 前端 bundle（`config/app.yaml`）。
- `app.auth.enabled` / `app.auth.api_key`：API Key 鉴权（`config/app.yaml` + `backend/py/src/crystalith/web/auth.py`）。
- `app.cors.allow_origins`：CORS 允许来源（`config/app.yaml`）。
- `app.startup.auto_db_init`：启动时自动跑迁移（`config/app.yaml` + `backend/py/src/crystalith/web/app.py:create_app` lifespan）。
- `plugins.enabled/disabled/load_order`：插件启用策略（`config/app.yaml` + `backend/py/src/crystalith/shared/plugins/registry.py:_order_entry_points`）。
- `providers.*` / `models.*`：模型与 provider 配置（`config/app.yaml`）。
- `vector_storage.*` / `database.*` / `cache.*`：存储与缓存（`config/app.yaml`；对应模型默认值见 `backend/py/src/crystalith/shared/config/models.py`）。
- `optional_services.*`：可选服务探测/降级策略（`config/app.yaml` + `backend/py/src/crystalith/web/app.py:_refresh_optional_services_status` 相关逻辑）。
- `source_ingestion.*`：URL 拉取与抽取（含 SSRF 保护配置）（`config/app.yaml`）。

## Dev / Run / Test（开发者使用指南）
```bash
# 创建 secrets 文件（不要提交）
cp config/secret.env.example config/secret.env    # 依据：config/secret.env.example 注释 + deployments/_NOTE.md

# 生成/校验配置 schema（不要手改 app.schema.gen.json）
cd backend/py
just config-schema                                 # 依据：backend/py/justfile:config-schema
just config-schema-check                           # 依据：backend/py/justfile:config-schema-check
```

```bash
# 用环境变量“填空式”初始化 .env 与 config/secret.env（会写文件；谨慎执行）
just upsert-env-configs                             # 依据：justfile:upsert-env-configs + scripts/init_config.sh
```

## Config / Observability（配置与可观测性）
- 配置定位 env（后端读取）：
  - `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`（SSOT：`backend/py/src/crystalith/shared/env.py`；说明：`deployments/_NOTE.md`）。
- overlay env：
  - `CRYSTALITH_ENV`（发现规则：`backend/py/src/crystalith/web/app.py:_discover_overlay_paths`；compose 默认传 `CRYSTALITH_ENV=docker`：`deployments/prod/docker-compose.yml`）。
- 文档参考（生成）：
  - `docs/doc/reference/config-schema.gen.md`（生成器：`backend/py/scripts/gen_docs.py`；导航：`docs/zensical.toml`）。

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 把 “overlay 文件命名/合并规则” 写到配置文档与示例里（动机：减少误用；收益：更少配置漂移；风险：需要保持与代码一致；方案：以 `backend/py/src/crystalith/web/app.py:_discover_overlay_paths` 和 `backend/py/src/crystalith/shared/config/manager.py:deep_merge` 为准补充 docs）。
  - 为 secrets 维护一份“最小必需清单”（动机：新手快速跑通；收益：减少启动失败；风险：随插件变化；方案：基于 `config/secret.env.example` + `config/app.yaml` 中引用的 `secret.*` 逐条维护）。
- 中期（1–2 月）
  - 为关键配置路径补“误配置诊断提示”（动机：定位快；收益：更好 UX；风险：提示需要本地化与维护；方案：沿用 `backend/py/src/crystalith/shared/config/manager.py` 的 UndefinedError 提示思路扩展到更多校验点）。
  - 补充“按 profile 推荐配置”章节（动机：部署更稳；收益：减少 docker/local 差异；风险：文档维护；方案：以 `.env.example` 的 profiles/ports 与 `config/app.yaml:*_candidates` 设计为依据写出建议）。
- 长期（季度+）
  - 配置 schema 做更强的跨字段约束（动机：提前失败；收益：少运行时坑；风险：更严格可能影响兼容；方案：在 `backend/py/src/crystalith/shared/config/models.py` 增加 model validators，保持默认配置可用）。
  - 建立“配置变更兼容策略”（动机：减少 breaking；收益：升级更平滑；风险：成本；方案：结合 `deployments/_NOTE.md` 的迁移风格，把 breaking 标注与迁移步骤写进 llmanspec change 流程）。

## Assumptions / TODO to Verify（已知未知）
- 当前 repo 是否已实际使用 `config/app.local.yaml` / `config/app.{env}.yaml`：从 `.gitignore` 与实际文件存在性确认（发现规则在 `backend/py/src/crystalith/web/app.py:_discover_overlay_paths`）。
- 插件自身的“配置 schema”如何暴露到 `config/app.schema.gen.json`：从 `backend/py/src/crystalith/shared/plugins/` 与各插件包的实现确认。
- `optional_services.*` 的 degrade_policy 在业务层如何体现：从 `backend/py/src/crystalith/web/app.py` 相关错误码/提示与调用方（前端）确认。
