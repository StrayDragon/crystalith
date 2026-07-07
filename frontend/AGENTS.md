# frontend（前端与 UI 相关代码）

> TL;DR：前端由两部分组成：`frontend/web`（Vite + React + TypeScript SPA）与 `frontend/packages/crystalith-slidev`（本地 Slidev 预览包，用于 iframe 预览）。前端通过 `/v1/**` 与后端交互（Vite proxy：`frontend/web/vite.config.ts`；后端路由注册：`backend/py/src/crystalith/web/routers.py`）。

## Scope（责任边界）

### 做什么
- 提供浏览器端 UI 与交互逻辑：`frontend/web/src/`（入口：`frontend/web/src/app/main.tsx`）。
- 生成并使用 OpenAPI 客户端：`frontend/web/openapi.gen.json` → `frontend/web/src/api/generated/`（脚本：`frontend/web/package.json:scripts.api:generate`）。
- 提供 Slidev 预览能力（本地）：`frontend/packages/crystalith-slidev`（默认读取 `data/output/preview/slides.md`，见 `frontend/packages/crystalith-slidev/README.md` 与 `scripts/ensure-preview.mjs`）。

### 不做什么
- 不承载后端实现/数据库迁移（见 `backend/`）。
- 不把前端当作配置入口；运行时/业务配置在 `config/app.yaml`（迁移说明：`deployments/_NOTE.md`）。

### 典型使用场景
- 本地 UI 开发：`cd frontend/web && pnpm dev`（脚本：`frontend/web/package.json:scripts.dev`）。
- 同步 API：`pnpm run api:sync`（脚本：`frontend/web/package.json:scripts.api:sync`）。
- 运行稳定测试门：`pnpm run test:ci` / `pnpm run test:core`（脚本同上；说明：`frontend/web/README.md` 与 `frontend/web/AGENTS.md`）。

## Integration（与项目的关系）

### 上游依赖
- 后端 API：
  - 本地 dev 默认代理到 `http://127.0.0.1:8032`（`frontend/web/vite.config.ts:apiProxyTarget`）
  - 路由清单：`backend/py/src/crystalith/web/routers.py:register_routers`
- OpenAPI schema：
  - 导出脚本：`backend/py/scripts/api_schema.py`（根目录任务：`justfile:api-export`）
  - 落盘文件：`frontend/web/openapi.gen.json`（命名含 `.gen.`，按规则为生成物：`AGENTS.md`）

### 下游使用者（已知）
- Nginx 前门（docker 部署）：前端容器 serve SPA 并反向代理后端（`dockers/nginx/default.conf`）。
- SDK/生成链路：后端 OpenAPI → 前端生成 client → SDK 生成（根目录 `justfile:api-sync` + `scripts/sdk_gen.sh`）。

### 关键集成点
- Vite proxy：`/v1` 与 `/health` 代理到后端（`frontend/web/vite.config.ts:server.proxy`）。
- API client 运行时配置：`frontend/web/src/api/setup.ts` 把 `client` 的 `baseUrl` 设为 `""`（相对路径），依赖 proxy/同源（`frontend/web/src/api/setup.ts:client.setConfig`）。
- z-index Layer 系统（避免硬编码 z-index）：说明与示例在 `frontend/web/AGENTS.md`，实现位于 `frontend/web/src/shared/layer`（参见该目录）。

### 依赖关系图
~~~text
backend/py --export OpenAPI--> frontend/web/openapi.gen.json --openapi-ts--> frontend/web/src/api/generated
   ^                                                                       |
   |                                                                       +--> frontend/web/src/api/setup.ts config + interceptors
   |
frontend/web (Vite :3000) --proxy /v1,/health--> backend/py (:8032)

frontend/packages/crystalith-slidev --reads--> data/output/preview/slides.md
(optional) docker slidev service (deployments/prod/docker-compose.slidev.yml) also reads data/
~~~

## Core Logic（核心概念与核心数据流）

### 术语表
- Vite proxy：前端开发时把 `/v1`、`/health` 请求转发到后端（`frontend/web/vite.config.ts`）。
- 生成 API client：`openapi.gen.json` → `src/api/generated`（`frontend/web/package.json:scripts.api:generate`）。
- "core suite"：最小 UI 核心回归清单（SSOT：`llmanspec/specs/quality-and-regression/core_suite.json`；引用：`frontend/web/AGENTS.md`）。

### 主流程（开发时）
1. 启动 dev server：`pnpm dev`（`frontend/web/package.json:scripts.dev`，端口：`frontend/web/vite.config.ts:server.port = 3000`）。
2. API 调用：
   - UI 使用生成 client（`frontend/web/src/api/generated/*`，由 `openapi-ts` 生成）。
   - `frontend/web/src/api/setup.ts` 配置错误拦截，把后端标准错误字段映射为 `Error`（见 `client.interceptors.error.use`）。
3. 同步 API schema：
   - `pnpm run api:fetch`：调用后端脚本导出 OpenAPI 到 `openapi.gen.json`（`frontend/web/package.json:scripts.api:fetch` → `backend/py/scripts/api_schema.py`）
   - `pnpm run api:generate`：生成 `src/api/generated`（同上）

### Slidev 预览（本地包）
- 入口脚本：`frontend/packages/crystalith-slidev/package.json:scripts.dev`
- 默认文件：`data/output/preview/slides.md`（若不存在会创建占位文件：`frontend/packages/crystalith-slidev/scripts/ensure-preview.mjs`）

## Dev / Run / Test（开发者使用指南）
```bash
# 前端安装与开发
cd frontend/web
pnpm install                         # 依据：frontend/web/AGENTS.md + frontend/web/justfile:install
pnpm dev                             # 依据：frontend/web/package.json:scripts.dev

# 质量门
pnpm run lint                        # 依据：frontend/web/package.json:scripts.lint
pnpm run format:check                # 依据：frontend/web/package.json:scripts.format:check
pnpm run typecheck                   # 依据：frontend/web/package.json:scripts.typecheck
pnpm run test:ci                     # 依据：frontend/web/package.json:scripts.test:ci
pnpm run test:core                   # 依据：frontend/web/package.json:scripts.test:core
```

```bash
# 同步 OpenAPI 并生成客户端（生成物：openapi.gen.json、src/api/generated）
pnpm run api:sync                    # 依据：frontend/web/package.json:scripts.api:sync
# 或 repo root：
just api-sync                        # 依据：justfile:api-sync
```

```bash
# Slidev 本地预览（会写 data/output/preview/slides.md；谨慎执行）
pnpm -C frontend/packages/crystalith-slidev install
pnpm -C frontend/packages/crystalith-slidev dev    # 依据：frontend/packages/crystalith-slidev/package.json
```

## Config / Observability（配置与可观测性）
- Vite proxy 目标：`VITE_API_PROXY_TARGET`（默认：`frontend/web/vite.config.ts:apiProxyTarget`）。
- 测试相关 env：
  - `VITEST_INCLUDE_EXPERIMENTAL`（`frontend/web/vite.config.ts`）
  - `VITEST_MSW_ON_UNHANDLED`（说明见 `frontend/web/README.md` 与 `frontend/web/package.json:scripts.test:*`）
- 依赖准备脚本：
  - `scripts/ensure_frontend_web_ready.sh` 会确保 pnpm install（被 `frontend/web/package.json` 的 `predev/prebuild/pretest/...` 调用）。

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 明确并标注“生成物目录”边界（动机：避免手改生成代码；收益：更少漂移；风险：需要清点；方案：对 `frontend/web/openapi.gen.json`、`frontend/web/src/api/generated/` 在 docs/AGENTS 中强调并在 `just check` 里保持 drift gate（已存在相关步骤：`justfile:check`））。
  - 补齐关键错误态与恢复动作 UI（动机：提升 UX；收益：更少“报错不知道怎么办”；风险：需要后端错误码稳定；方案：基于 `frontend/web/src/api/setup.ts` 的 `errorCode/details/retryAfter` 映射逐步完善 UI 提示）。
- 中期（1–2 月）
  - 扩展 `test:core` 覆盖的核心路径与 fixtures（动机：前后端协同回归；收益：更稳；风险：维护成本；方案：以 `llmanspec/specs/quality-and-regression/core_suite.json` 为 SSOT，逐步补齐缺口）。
  - 性能与分包策略持续演进（动机：减小首屏；收益：更快加载；风险：chunk 过多；方案：基于 `frontend/web/vite.config.ts:manualChunks` 的现有策略做数据驱动调整）。
- 长期（季度+）
  - 建立更强的“契约化集成”流程（动机：减少 API/客户端漂移；收益：发布更稳；风险：需要流程投入；方案：对齐后端 `just api-check`、前端 `api:sync`、以及 SDK 生成（`scripts/sdk_gen.sh`）形成一条可审计流水线）。

## Assumptions / TODO to Verify（已知未知）
- 哪些业务域 UI 对应哪些后端路由：从 `frontend/web/src/features/workspace/domains/*` 与 `backend/py/src/crystalith/web/routers.py` 交叉确认（目录存在性：`frontend/web/src/features/workspace/`）。
- docker 部署下 Slidev 是否对所有用户开启：从 `deployments/prod/docker-compose.slidev.yml` 的 overlay 组合与 `dockers/nginx/default.conf` 的代理规则确认。
