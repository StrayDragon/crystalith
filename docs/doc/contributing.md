# 贡献指南

## 仓库结构

- `backend/py/`: FastAPI 服务（应用代码在 `backend/py/src/crystalith/`）
- `frontend/web/`: Vite + React 前端
- `config/`: 运行时配置（`app.yaml`）及 schema（`app.schema.gen.json`）
- `openspec/`: 规范与变更追踪
- `sdk/`: 生成的 SDK 及生成器配置

## 仓库入口

查看 `justfile` 了解仓库入口（运行 `just -l`）。

## 开发

后端：

```bash
cd backend/py
uv sync
just dev
```

前端：

```bash
cd frontend/web
pnpm install
pnpm dev
```

主机开发时可选的 Slidev 预览服务：

```bash
just dev-slidev
```

说明：
- 前端 dev/build/test/typecheck 命令会在需要时自动初始化 `frontend/web/vendor/rivu`。
- 手动回退方式：`just rivu-submodule-update`

## 测试

```bash
cd backend/py && just test
cd frontend/web && pnpm test
```

## Lint / 契约检查

```bash
cd backend/py && just lint
cd backend/py && just contract
cd frontend/web && pnpm run lint
cd frontend/web && pnpm run format:check
```

说明：
- `pnpm -C frontend/web run lint` 对变更的前端源文件运行增量 `oxlint`（默认基准：`origin/main`，不可用时使用本地回退）。
- `pnpm -C frontend/web run lint:all` 对 `frontend/web/src` 运行完整 `oxlint`，并展示仓库基线警告，无需立即清理。
- `pnpm -C frontend/web run format` 应用 `oxfmt`；在验证流程中使用 `pnpm -C frontend/web run format:check`。

## 配置 schema

若修改了配置模型，需重新生成 `config/app.schema.gen.json`：

```bash
cd backend/py && just config-schema
```

## Eval / 回归测试

生成离线 JSON + Markdown 报告（默认不发起网络请求或真实模型调用）：

```bash
cd backend/py && just llm-eval
```

要对比多次运行结果，可将生成的 `backend/py/llm_eval_reports/llm_eval_report.json` 作为基线，与新运行结果进行 diff。

## OpenAPI / 生成客户端

若修改了后端 API：

```bash
pnpm -C frontend/web run api:sync
```

## 提交信息

使用简短的类型前缀，例如：

- `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
