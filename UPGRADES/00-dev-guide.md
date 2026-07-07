# 00-dev — 本地全热重载开发环境指南（Python 参考实现）

> 两个终端窗口，前后端同时热重载。无需 Docker，全本地即可开发。
> **适用**: 当前 Python 后端（v1 参考实现）。v2 Bun/TS 开发环境将在 Phase 0 搭建。

---

## 前置条件

```bash
# 确认工具已安装
python --version     # ≥ 3.12
uv --version         # pip install uv 或 curl -LsSf https://astral.sh/uv/install.sh | sh
node --version       # ≥ 20
pnpm --version       # corepack enable && corepack prepare pnpm@latest --activate
```

---

## 一次性初始化

```bash
# === 1. 后端 Python 依赖 ===
cd backend/py
uv sync
cd ../..

# === 2. 前端 JS 依赖 ===
cd frontend/web
pnpm install
cd ../..

# === 3. 初始化本地数据库（SQLite） ===
cd backend/py
just db-init
cd ../..

# === 4. 确保本地 OpenAI-compatible 服务可达（如果使用本地模型） ===
# 本地模型需通过 OpenAI-compatible API 暴露（如 llama.cpp server、vLLM、MLX 等）
# 设置 OPENAI_BASE_URL 指向你的本地端点
```

---

## 启动开发（两个终端）

### 终端 A：后端

```bash
cd backend/py

# 默认使用 config/app.yaml 中的 local 配置
# SQLite + 内嵌 Chroma + 内存缓存
# 端口 8032，自动重载
uv run python main.py
```

输出看到：
```
INFO:     Uvicorn running on http://127.0.0.1:8032
INFO:     Started reloader process
```

### 终端 B：前端

```bash
cd frontend/web
pnpm dev
```

输出看到：
```
  VITE v7.x.x  ready in xxx ms
  ➜  Local:   http://localhost:3000/
```

浏览器打开 `http://localhost:3000`，前端请求通过 Vite proxy 自动转发到 `http://127.0.0.1:8032`。

---

## 热重载范围

| 文件 | 热重载？ | 说明 |
|------|---------|------|
| 后端 `*.py` | ✅ 自动 | uvicorn `--reload` 默认开启 |
| 前端 `*.tsx/*.ts` | ✅ 自动（HMR） | Vite 原生支持 |
| 前端 CSS/Tailwind | ✅ 即时 | HMR |
| `config/app.yaml` | ❌ 需重启后端 | uvicorn 不监听非 Python 文件 |
| 数据库 schema 变更 | ❌ 需手动迁移 | `just db-migrate` |

---

## 常用开发命令速查

```bash
# ====== 后端 ======
cd backend/py

# 开发服务器（热重载）
uv run python main.py

# 跑测试
just test                 # 所有测试
just test-core            # 核心测试
just test-bdd             # BDD 测试
just test packages-test   # workspace 包测试

# 类型检查
just typecheck

# 代码风格
just lint

# 完整 CI 检查
just check

# 查看覆盖率
just coverage

# 数据库操作
just db-init              # 初始化表
just db-migrate "描述"    # 创建新 migration
just db-rollback          # 回滚上一个 migration

# 配置 schema
just config-schema        # 重新生成 config/app.schema.gen.json

# ====== 前端 ======
cd frontend/web

# 开发服务器（热重载）
pnpm dev

# 跑测试
pnpm test

# 类型检查
pnpm typecheck

# 代码风格
pnpm run lint             # 只检查改动的文件
pnpm run format           # 格式化

# API 客户端同步（如果改了后端 API）
pnpm run api:sync         # 从后端 OpenAPI 重新生成客户端代码

# 构建生产版本
pnpm run build
```

---

## 环境变量（可选）

`config/app.yaml` 中的 `{{ env.XXX }}` 和 `{{ secret.XXX }}` 模板变量需要从环境变量或文件读取。

```bash
# 快速设置（用于本地开发，替换为你的 API key）
export OPENAI_API_KEY="sk-xxx"

# 或创建 config/secret.env（gitignored）
echo 'OPENAI_API_KEY=sk-xxx' > config/secret.env
```

本地模型通过 OpenAI-compatible API 暴露时，配置 `OPENAI_BASE_URL` 指向本地端点即可。

---

## 调试技巧

### 后端日志级别

```bash
cd backend/py
LOG_LEVEL=DEBUG uv run python main.py
```

### 前端网络请求调试

浏览器 DevTools → Network 标签，过滤 `v1/` 查看 API 请求。

### 数据库直接查看

```bash
# SQLite 数据库文件在 backend/py/data/app.db
sqlite3 backend/py/data/app.db ".tables"
sqlite3 backend/py/data/app.db "SELECT * FROM notebooks;"
```

### Chroma 向量数据

```bash
# 内嵌 Chroma 数据在 config/app.yaml 配置的路径
# 默认：./data/chroma
ls backend/py/data/chroma/
```

---

## 故障排查

| 问题 | 检查 |
|------|------|
| 后端启动报 module not found | 运行过 `uv sync` 了吗？ |
| 前端 404 / API 不通 | 后端在 8032 端口跑着吗？ |
| 本地模型调用失败 | 检查 `OPENAI_BASE_URL` 配置和模型服务是否运行 |
| `just` 命令不识别 | `cargo install just` 或 `brew install just` |
| 数据库表不存在 | 运行 `just db-init` |
| pnpm 找不到 Python | `uv run` 需要先 `uv sync` |
