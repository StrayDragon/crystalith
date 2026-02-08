# NEXT - 续做接力记录

更新时间：2026-02-08 17:18 CST
分支：`main`

## 1) 当前总状态（下次开工先看这里）

- `refactor-state-to-zustand` 已完成并归档：`openspec/changes/archive/2026-02-08-refactor-state-to-zustand/`
- `optimize-frontend-performance` 已完成并归档：`openspec/changes/archive/2026-02-08-optimize-frontend-performance/`
- `enhance-ux-polish` 已完成并归档：`openspec/changes/archive/2026-02-08-enhance-ux-polish/`（Source 索引百分比 SSE 相关项移出本变更）
- `add-dark-mode-v2` 已归档：`openspec/changes/archive/2026-02-08-add-dark-mode-v2/`
- `add-keyboard-shortcuts` 已完成并归档：`openspec/changes/archive/2026-02-08-add-keyboard-shortcuts/`
- `add-output-export-v2` 已完成并归档：`openspec/changes/archive/2026-02-08-add-output-export-v2/`（`workspace-ui` spec 已更新）
- `add-backend-dependency-injection` 已完成并归档：`openspec/changes/archive/2026-02-08-add-backend-dependency-injection/`
- `add-database-migration` 已完成并归档：`openspec/changes/archive/2026-02-08-add-database-migration/`
- `add-caching-layer` 已完成并归档：`openspec/changes/archive/2026-02-08-add-caching-layer/`
- `add-production-docker` 已完成并归档：`openspec/changes/archive/2026-02-08-add-production-docker/`
- `add-workspace-templates` 已完成并归档：`openspec/changes/archive/2026-02-08-add-workspace-templates/`
- `add-plugin-architecture` 已完成并归档：`openspec/changes/archive/2026-02-08-add-plugin-architecture/`
- `_SEQ` 已更新：补齐 `add-plugin-architecture` 归档状态；下一步暂无（Obsidian 暂缓）

## 2) 本轮已完成（开发 -> 测试 -> 验收）

### A. 快捷键系统能力

- 新增 `useKeyboardShortcuts`（注册/注销/分发/冲突检测/输入框冲突规避）：
  - `frontend/web/src/features/workspace/shared/hooks/useKeyboardShortcuts.ts`
- 新增快捷键配置映射：
  - `frontend/web/src/features/workspace/shared/shortcuts.ts`
- 新增帮助面板（`Ctrl+?`，分类展示，走 LayerProvider z-index）：
  - `frontend/web/src/features/workspace/layout/ShortcutHelpPanel.tsx`
- 集成到工作区布局（`Ctrl+K/N/1/2/3/Ctrl+Enter/Escape/Ctrl+?`）：
  - `frontend/web/src/features/workspace/layout/WorkspaceLayout.tsx`

### B. 快捷键相关增强

- Notebook hook 增加快捷创建能力（供 `Ctrl+N` 调用）：
  - `frontend/web/src/features/workspace/domains/notebooks/useNotebooks.ts`

### C. 自动化测试与验收

- Hook 单元测试：
  - `frontend/web/src/features/workspace/shared/hooks/useKeyboardShortcuts.test.tsx`
- Live E2E 交互测试：
  - `frontend/web/e2e/workspace.shortcuts.live.spec.ts`
- 已通过命令：
  - `pnpm test --run src/features/workspace/shared/hooks/useKeyboardShortcuts.test.tsx`
  - `pnpm test:e2e --project=live --grep "keyboard shortcuts"`
  - `pnpm run build`
  - `openspec validate add-keyboard-shortcuts --strict --no-interactive`
  - `openspec archive add-keyboard-shortcuts --yes`

### D. 输出导出（add-output-export-v2）

- 新增导出基础设施（格式映射 + 文件名 + 内容转换）：
  - `frontend/web/src/features/workspace/domains/outputs/exporters.ts`
  - `frontend/web/src/features/workspace/domains/outputs/useExport.ts`
- 输出查看器增加统一导出入口（Markdown/JSON/PDF/PPTX）：
  - `frontend/web/src/features/workspace/domains/outputs/OutputContent.tsx`
- Studio 输出列表菜单集成导出动作：
  - `frontend/web/src/features/workspace/domains/studio/StudioOutputsList.tsx`
- 新增单元测试：
  - `frontend/web/src/features/workspace/domains/outputs/exporters.test.ts`
  - `frontend/web/src/features/workspace/domains/outputs/useExport.test.tsx`
  - `frontend/web/src/features/workspace/domains/outputs/OutputContent.test.tsx`
- 已通过命令：
  - `pnpm -C frontend/web test --run src/features/workspace/domains/outputs/*`
  - `pnpm -C frontend/web run build`
  - `openspec validate add-output-export-v2 --strict --no-interactive`
  - `openspec archive add-output-export-v2 --yes`
- DevTools 手动验收：
  - FAQ/Quiz/Briefing/Slides 的导出菜单展示正确（Markdown + 特殊格式）
  - 点击导出可触发浏览器下载（DevTools 通过 `URL.createObjectURL` 计数验证）

### E. 归档收尾（optimize-frontend-performance / enhance-ux-polish）

- `optimize-frontend-performance` 补齐验收项（DevTools Network 观察懒加载 chunk 仅在点击时加载），并已归档：
  - `openspec archive optimize-frontend-performance --yes`
- `enhance-ux-polish` 将 3.3/3.4（Source 索引百分比 SSE 链路）移出本变更并已归档：
  - `openspec archive enhance-ux-polish --yes`

### F. 生产部署 Docker Compose（add-production-docker）

- 生产 Compose：`docker-compose.prod.yml`（Postgres + Chroma + 可选 Redis + nginx 反代）
- 后端/前端多阶段 Dockerfile：
  - `dockers/backend/Dockerfile`
  - `dockers/frontend/Dockerfile`
  - `dockers/nginx/default.conf`
- 环境变量覆盖与 secrets 支持：
  - `backend/py/src/crystalith/shared/config/manager.py`
  - `backend/py/src/crystalith/web/app.py`
- 外置 Chroma HTTP VectorStore（避免 API 镜像携带 chromadb 重依赖）：
  - `backend/py/src/crystalith/shared/vector_storage/chroma_http.py`
- 部署文档：`docs/deployment.md`
- 已通过验收（本机 Docker）：
  - `docker compose -f docker-compose.prod.yml up -d --build`
  - `/health`、OpenAPI UI 正常
  - Postgres 持久化验证：`docker compose down && up -d` 后 notebook 仍存在
  - DevTools（MCP）验收：Workspace UI 可正常加载/浏览 notebook、source、session、output

### G. 工作区模板（add-workspace-templates）

- 后端：新增 `templates` feature slice（CRUD + 保存 notebook 为模板），并支持 `POST /v1/notebooks?template_id=...` 从模板创建 notebook
- 数据库：新增 `templates` 表 + Alembic 迁移（并修复本地 DB 漂移导致的 `table templates already exists` 升级失败）
- 前端：NotebookSwitcher 集成“从模板创建 / 保存为模板 / 模板管理”，并新增 `useTemplates` 单测
- 已通过命令：
  - `cd backend/py && just test`
  - `pnpm -C frontend/web test --run src/features/workspace/domains/templates/useTemplates.test.tsx`
  - `pnpm -C frontend/web run build`
  - `openspec validate add-workspace-templates --strict --no-interactive`
  - `openspec archive add-workspace-templates --yes`
- DevTools（MCP）验收：
  - 模板列表包含 3 个内置模板
  - 从模板创建 notebook 后 session/tag 预配置生效
  - 保存为模板 + 模板管理（内置不可编辑/删除，自定义可编辑/删除）

### H. 插件架构（add-plugin-architecture）

- 新增插件系统骨架（entry_points: `crystalith.plugins`）：
  - `backend/py/src/crystalith/shared/plugins/interfaces.py`
  - `backend/py/src/crystalith/shared/plugins/registry.py`
- 支持配置 enable/disable（`plugins.enabled`/`plugins.disabled`）并写入 schema：
  - `backend/py/src/crystalith/shared/config/models.py`
  - `config/schema.json`
- 接入点：
  - AI provider 工厂：`backend/py/src/crystalith/shared/ai/factory.py`
  - Parser 工厂：`backend/py/src/crystalith/shared/parsers/factory.py` + Sources 上传链路注入 registry
  - Output generator：`backend/py/src/crystalith/shared/agents/output_graph.py`（允许插件覆盖既有 OutputType 的 schema/prompt）
- `/v1/models` 返回包含插件 provider（新增 `providers` 字段），并过滤掉 disabled/missing provider：
  - `backend/py/src/crystalith/features/models/api.py`
  - `frontend/web` OpenAPI/TS client 已重新生成
- 开发者支持：
  - 文档：`docs/plugins.md`
  - Cookiecutter 模板：`backend/py/tools/cookiecutter-crystalith-plugin/`
  - 示例插件：`backend/py/examples/crystalith-echo-plugin/`
  - 合规性检查工具：`backend/py/scripts/check_plugins.py`
- 测试与验收：
  - `cd backend/py && just test`
  - `pnpm -C frontend/web test` + `pnpm -C frontend/web run build`
  - DevTools 验收：在 `http://localhost:3000/` 执行 `fetch('/v1/models')`，`providers` 包含 `echo`

## 3) 下一步（按 _SEQ）

1. Obsidian 相关继续暂缓。
2. 目前 `openspec/changes/` 下仅剩 `add-obsidian-integration`（继续暂缓）；如需继续推进，建议新建独立 change 先补齐内置基础链路。
3. 若要补齐 Source 索引百分比 SSE 链路：建议新建独立 change（从 `source-ingestion` / `workspace-ui` 两端拆分任务）。

## 4) 备注

- Obsidian 相关继续暂缓。
- 若后端本地 DB 存在历史枚举值（如 `READY`）导致 `/v1/notebooks` 500，优先使用 `/tmp` 独立配置启动后端做验收。
