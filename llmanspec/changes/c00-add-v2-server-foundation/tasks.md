# add-v2-server-foundation — Tasks

## 1. Workspace Setup

- [x] 创建根 `package.json` 声明 workspaces: `["server", "frontend/web", "packages/*"]`
- [x] 创建 `packages/shared/` (package.json + tsconfig.json + src/index.ts)
- [x] 创建 `server/` (package.json + tsconfig.json + src/server.ts)

## 2. Install & Build

- [x] `bun install` 从根目录成功，产出 `bun.lock`
- [x] `bun run --cwd server dev` 启动 Elysia server
  - 验证: `curl http://localhost:8032/health` → `{"status":"ok","version":"2.0.0-dev"}`
  - 验证: `curl http://localhost:8032/v2/` → `{"message":"Crystalith v2 API"}`

## 3. Frontend Migration

- [x] 删除 `pnpm-lock.yaml`、`pnpm-workspace.yaml`
- [x] `package.json`: `pnpm run` → `bun run`，删除 `api:fetch`/`api:sync`/`api:check`
- [x] `package.json`: `packageManager` → `bun@1.3.14`
- [x] `vite.config.ts`: 清理 stale alias (rivu, @crystalith-slidev)
- [x] `vite.config.ts`: 添加 `@crystalith/shared` alias
- [x] `scripts/ensure_frontend_web_ready.sh`: pnpm → bun

## 4. CI / Pre-commit

- [x] `.github/workflows/ci.yml`: `pnpm/action-setup` → `oven-sh/setup-bun@v2`
- [x] `.pre-commit-config.yaml`: hooks 全部 `pnpm run` → `bun run`
- [x] `justfile`: 全部 `pnpm` → `bun`

## 5. Documentation

- [x] `AGENTS.md`: 更新项目结构、build/dev 命令
- [x] `backend/AGENTS.md`, `backend/py/AGENTS.md`: v1 reference notice
- [x] `config/AGENTS.md`, `frontend/AGENTS.md`, `frontend/web/AGENTS.md`: v2 更新

## Verification

```bash
bun install                    # 全 workspace 安装成功
bun run --cwd server dev &     # Server 启动
curl localhost:8032/health     # health check 通过
bun run --cwd frontend/web dev # Vite dev server 启动
kill %1
```
