# data（运行时数据目录）

> TL;DR：本目录用于存放本地/部署运行时产生的数据与输出（SQLite DB、Chroma 向量数据、预览/导出产物等）。默认被 Git 忽略（`.gitignore` 包含 `data/`），一般不应提交真实数据文件。

## Scope（责任边界）

### 做什么
- 承载默认数据路径（来自配置）：
  - SQLite：`config/app.yaml:database.url` 默认 `sqlite+aiosqlite:///./data/app.db`
  - Chroma：`config/app.yaml:vector_storage.chroma.path` 默认 `./data/chroma`
- 承载预览/输出文件：
  - Slidev 预览 deck：`data/output/preview/slides.md`（本地包：`frontend/packages/crystalith-slidev/package.json`；容器 entrypoint：`dockers/slidev/entrypoint.sh`）
- 在 Docker 部署时作为 volume 挂载到容器：
  - `deployments/prod/docker-compose.yml:services.api.volumes` 把 `../../data` 挂载到 `/app/data`
  - `deployments/prod/docker-compose.slidev.yml:services.slidev.volumes` 把 `../../data` 挂载到 `/data`

### 不做什么
- 不存放源码/配置；配置在 `config/`，源码在 `backend/` / `frontend/`。
- 不保证可复现（它是运行态产物目录，通常会随运行变化）。

### 典型使用场景
- 本地 dev：运行后端会创建/更新 SQLite 与 Chroma 数据（默认路径见 `config/app.yaml`）。
- Slidev 预览：生成/编辑 `data/output/preview/slides.md`，由 Slidev 服务实时预览（见 `frontend/packages/crystalith-slidev/README.md`）。

## Integration（与项目的关系）

### 上游依赖
- `config/app.yaml`：决定数据落盘的默认相对路径（`database.url` / `vector_storage.chroma.path`）。
- 可选 env 覆盖：`CRYSTALITH_DATA_DIR`（env SSOT：`backend/py/src/crystalith/shared/env.py`）。

### 下游使用者（已知）
- 后端：
  - 数据库存储：默认落在 `data/app.db`（配置：`config/app.yaml`；模型默认值见 `backend/py/src/crystalith/shared/config/models.py:DatabaseSettings`）。
  - 向量存储：默认落在 `data/chroma/`（配置：`config/app.yaml`）。
- Slidev（本地/容器）：
  - 本地：`frontend/packages/crystalith-slidev/scripts/ensure-preview.mjs` 默认读取/创建 `data/output/preview/slides.md`
  - 容器：`dockers/slidev/entrypoint.sh` 默认读取/创建 `/data/output/preview/slides.md`（volume 映射到 repo 的 `data/`）

### 依赖关系图
~~~text
backend/py (FastAPI) ----writes----> data/app.db + data/chroma/
   |
   +-- generates preview outputs --> data/output/preview/slides.md (if slides workflow is used)

frontend/packages/crystalith-slidev ----reads----> data/output/preview/slides.md
dockers/slidev (container)          ----reads----> /data/output/preview/slides.md (volume)
~~~

## Core Logic（核心概念与数据流）

### 术语表
- “配置根目录锚定”：SQLite/embedded Chroma 的相对路径锚定到 config root（说明：`backend/py/README.md`）。
- “预览 deck”：Slidev 使用的 Markdown deck 文件（默认：`data/output/preview/slides.md`；见 `dockers/slidev/entrypoint.sh` 与 `frontend/packages/crystalith-slidev/scripts/ensure-preview.mjs`）。

### 主流程（可能的运行时数据流）
1. 后端启动后，根据 `config/app.yaml` 的相对路径创建/使用 SQLite/Chroma 数据文件夹（配置项见 `config/app.yaml:database` / `vector_storage`）。
2. 当使用 slides 工作流时，Slidev 预览会读取 `data/output/preview/slides.md`：
   - 本地：`frontend/packages/crystalith-slidev/package.json:scripts.dev`
   - docker：`deployments/prod/docker-compose.slidev.yml` + `dockers/slidev/entrypoint.sh`

### 重要边界条件
- Git 忽略：`data/` 默认被 `.gitignore` 忽略（`.gitignore`）。
- 权限修复：docker 部署包含 `data-init` one-shot 容器来创建 `output/preview` 并修复权限（`deployments/prod/docker-compose.yml:services.data-init`）。
- 旧路径迁移：`backend/py/README.md` 提醒把旧的 `backend/py/data/*` 迁移到 `<repo>/data/*`。

## Dev / Run / Test（开发者使用指南）
- 清理/排障建议（不执行）：
  - `just cleanup` 会检测 `data/` 下的空目录并给出提示（脚本：`scripts/cleanup.sh`；入口：`justfile:cleanup`）。
- Slidev 本地预览（会写 `data/output/preview/slides.md`；谨慎执行）：
  - 入口：`frontend/packages/crystalith-slidev/package.json:scripts.dev`
  - 辅助脚本：`frontend/packages/crystalith-slidev/scripts/ensure-preview.mjs`

## Config / Observability（配置与可观测性）
- 数据目录覆盖 env：`CRYSTALITH_DATA_DIR`（SSOT：`backend/py/src/crystalith/shared/env.py`）。
- 默认路径（配置）：
  - `database.url`（`config/app.yaml`）
  - `vector_storage.chroma.path`（`config/app.yaml`）

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 明确并文档化 `data/` 的子目录约定（动机：避免“文件放哪”混乱；收益：更好维护；风险：需要与现有代码一致；方案：从 `config/app.yaml` 的默认路径与 `dockers/slidev/entrypoint.sh` 的预览目录约定出发，补充 docs）。
  - 增加“安全清理”脚本/指引（动机：减少磁盘膨胀；收益：开发体验更好；风险：误删；方案：扩展 `scripts/cleanup.sh` 的 data 检查逻辑，保持默认 dry-run，明确 `--apply` 风险）。
- 中期（1–2 月）
  - 为输出产物建立可追踪的命名/元数据（动机：可复查；收益：更容易定位某次生成；风险：引入更多文件；方案：在 `data/output/` 下引入按 run/session 分目录（需先在后端实现并写入 docs/spec））。
  - 提供“可选持久化/备份策略”文档（动机：自托管需要；收益：更稳；风险：多环境差异；方案：结合 `deployments/prod/docker-compose.yml` 的 volume 方式，给出迁移建议）。
- 长期（季度+）
  - 将 `data/` 的职责细分为可配置多存储后端（动机：规模化；收益：更强扩展性；风险：实现复杂；方案：以 `config/app.yaml` 的 `*_candidates` 与 `optional_services.*` 机制为基础演进）。

## Assumptions / TODO to Verify（已知未知）
- 后端是否还会把上传/中间文件写入 `data/`（除 DB/Chroma/preview 之外）：从 `backend/py/src/crystalith/` 内对 `CRYSTALITH_DATA_DIR` 或 `data/` 的引用检索确认（env SSOT：`backend/py/src/crystalith/shared/env.py`）。
- slides 工作流生成 `slides.md` 的触发点与格式约束：从 `backend/py/src/crystalith/features/studio/` 与插件 `backend/py/plugins/crystalith-slides-slidev` 交叉确认。
