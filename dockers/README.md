# dockers（Docker 镜像构建与运行配置）

> TL;DR：本目录包含 Crystalith 的 Dockerfile 与 Nginx 配置：后端 API、前端静态站点（Vite build + Nginx）、可选 Slidev 预览服务、以及 host-remap 端口转发辅助容器。它们由 compose 文件引用（例如 `deployments/prod/docker-compose.yml`）。

## Scope（责任边界）

### 做什么
- 定义镜像构建方式：
  - 后端：`dockers/backend/Dockerfile`
  - 前端：`dockers/frontend/Dockerfile`
  - Slidev：`dockers/slidev/Dockerfile` + `dockers/slidev/entrypoint.sh`
  - host-remap：`dockers/host-remap/Dockerfile`
- 定义前端入口 Nginx 反向代理行为：`dockers/nginx/default.conf`

### 不做什么
- 不负责选择运行 profile/overlays（见 `scripts/orchestrate.sh`、`scripts/dev_compose.sh`、`deployments/`）。
- 不承载业务配置（SSOT：`config/app.yaml`，迁移说明：`deployments/_NOTE.md`）。

## Integration（与项目的关系）

### 被谁引用
- Compose build 引用：
  - `deployments/prod/docker-compose.yml:services.web.build.dockerfile` → `dockers/frontend/Dockerfile`
  - `deployments/prod/docker-compose.yml:services.api.build.dockerfile` → `dockers/backend/Dockerfile`
  - `deployments/prod/docker-compose.slidev.yml:services.slidev.build.dockerfile` → `dockers/slidev/Dockerfile`
  - `deployments/prod/docker-compose.host-remap.yml:services.host-remap.build.dockerfile` → `dockers/host-remap/Dockerfile`

### 依赖关系图
~~~text
deployments/prod/docker-compose.yml
  |-- build web  --> dockers/frontend/Dockerfile --> dist --> nginx (dockers/nginx/default.conf)
  |-- build api  --> dockers/backend/Dockerfile  --> python main.py (:8032)
  |-- optional   --> dockers/slidev/*            --> slidev (:3030)
  |-- optional   --> dockers/host-remap/*        --> socat forwards
~~~

## Core Logic（核心概念与核心数据流）

### 术语表
- build args：构建时参数（例如 `PYTHON_IMAGE`、`UV_IMAGE`、`NPM_REGISTRY`；来源：`.env.example` + compose build args）。
- CN mirror：国内镜像策略（Dockerfile 中 `USE_CN_MIRROR` 默认开启；见 `dockers/backend/Dockerfile` 与 `dockers/frontend/Dockerfile`）。
- “前门” Nginx：前端容器既 serve 静态文件也反向代理 API/Slidev（`dockers/nginx/default.conf`）。

### 后端镜像（`dockers/backend/Dockerfile`）
- 多阶段构建：
  - builder 使用 `uv`（镜像：`ghcr.io/astral-sh/uv`，见 Dockerfile ARG），安装依赖到 `/opt/venv`（`ENV UV_PROJECT_ENVIRONMENT=/opt/venv`）。
  - runtime 复制虚拟环境与必要代码，运行 `python main.py`（`CMD ["python","main.py"]`）。
- 依赖来源与内容：
  - 复制 `backend/py/pyproject.toml`、`backend/py/uv.lock`、`packages/`、`plugins/`、`src/` 等（见 Dockerfile COPY 段）。
  - `CRYSTALITH_BACKEND_EXTRAS` 可传入 uv extras（见 Dockerfile ARG 与 `uv sync` 参数拼装）。
- 健康检查：请求 `http://localhost:8032/health`（见 Dockerfile HEALTHCHECK；对应 API：`backend/py/src/crystalith/web/app.py:create_app`）。

### 前端镜像（`dockers/frontend/Dockerfile` + `dockers/nginx/default.conf`）
- build 阶段：
  - 使用 corepack + pnpm（版本由 `PNPM_VERSION` 控制，见 Dockerfile ARG）。
  - `pnpm run build` 产物输出到 `frontend/web/dist`（Vite 默认；见 `frontend/web/package.json:scripts.build`）。
- runtime 阶段：
  - 把 `dist` 拷贝到 Nginx html root（Dockerfile COPY）。
  - 使用自定义配置文件 `dockers/nginx/default.conf`。
- 反向代理：
  - `/v1/`、`/health`、`/health/dependencies` 代理到 `api:8032`，并为 SSE 关闭 buffer（`dockers/nginx/default.conf`）。
  - `/slidev/` 及若干 Slidev 资产路径代理到 `slidev:3030`（同文件）。

### Slidev 镜像（`dockers/slidev/Dockerfile` + `dockers/slidev/entrypoint.sh`）
- 目标：为工作区提供 Slidev 预览服务（compose overlay：`deployments/prod/docker-compose.slidev.yml`）。
- entrypoint 行为：
  - 创建 `/data/output/preview/slides.md` 占位文件（若不存在）（`dockers/slidev/entrypoint.sh`）。
  - 把 `/app/node_modules` 软链到预览目录，确保主题解析（同上）。
  - 启动 `slidev` 监听 `:3030`（同上）。

### host-remap 镜像（`dockers/host-remap/Dockerfile`）
- 基于 alpine 安装 `socat`，用于端口转发（compose overlay：`deployments/prod/docker-compose.host-remap.yml`，变量：`BRIDGE_FORWARDS` 来自 `.env.example`）。

## Dev / Run / Test（开发者使用指南）
```bash
# 构建/运行通常由 compose 驱动（会创建容器；谨慎执行）
just up docker                       # 依据：justfile:up + deployments/prod/docker-compose.yml
just up full                         # 依据：.env.example FULL_SERVICES + scripts/orchestrate.sh
```

构建与镜像参数（模板与说明：`.env.example`）：
- 基础镜像：`PYTHON_IMAGE`、`UV_IMAGE`、`NODE_IMAGE`、`NGINX_IMAGE` 等
- 镜像构建镜像源：`APT_MIRROR`、`UV_INDEX_URL`、`NPM_REGISTRY`
- 镜像构建开关：`USE_CN_MIRROR`（见 compose build args 与 Dockerfile ARG）

## Config / Observability（配置与可观测性）
- Nginx 代理与健康检查路径：`dockers/nginx/default.conf`
- API 健康检查端点：`backend/py/src/crystalith/web/app.py:create_app`（/health、/health/dependencies）
- compose 默认会剥离 HTTP(S)_PROXY 环境变量（除非 `CRYSTALITH_KEEP_PROXY_ENV=1`）：`scripts/dev_compose.sh` 的 proxy_env 逻辑。

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 为镜像构建参数补充“可用值/常见问题”表（动机：减少构建失败；收益：更快落地；风险：维护；方案：基于 `.env.example` + Dockerfile ARG 列表维护）。
  - 收敛 Slidev 与本地预览的行为差异（动机：一致性；收益：更少环境差异；风险：需要验证；方案：对齐 `dockers/slidev/entrypoint.sh` 与 `frontend/packages/crystalith-slidev/scripts/ensure-preview.mjs` 的占位文件内容/路径策略）。
- 中期（1–2 月）
  - 优化镜像层缓存（动机：CI 更快；收益：构建时间下降；风险：Dockerfile 调整；方案：保持 COPY 顺序与 lockfile 驱动缓存（已部分采用），进一步按 workspace 粒度拆分）。
  - 增加最小权限与安全基线说明（动机：生产安全；收益：减少误配；风险：文档/测试成本；方案：记录 `api` 容器以非 root 用户运行（`dockers/backend/Dockerfile`）与 config 挂载只读（compose）等约束）。
- 长期（季度+）
  - 提供可选的多架构构建与镜像签名策略（动机：发布；收益：供应链更稳；风险：需要 CI/发布流程投入；方案：与 `vendor/crystalith-sdks` 的发布策略保持一致风格）。

## Assumptions / TODO to Verify（已知未知）
- Nginx 下 OpenAPI UI/JSON 的访问路径是否需要额外 proxy：对照 `backend/py/src/crystalith/shared/config/models.py:AppSettings`（openapi_path/openapi_ui_path）与 `dockers/nginx/default.conf` 当前 location 规则核对。
- Slidev 在生产部署中是否必须启用（vs 可选）：从 `config/app.yaml` 的插件启用策略与 `deployments/prod/docker-compose.slidev.yml` 的默认 overlay 组合确认（`.env.example FULL_SERVICES`）。
