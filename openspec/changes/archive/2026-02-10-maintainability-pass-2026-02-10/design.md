## Context

本次变更聚焦“可维护性与可交付性”，涉及后端、前端、任务队列与部署构建链路：

- 后端存在千行级 API 模块（例如 sources），单文件混合 schemas、路由、业务、存储写入与辅助逻辑，导致改动半径大、review 困难、回归风险上升。
- 前端 workspace 布局与多个 panel 体量过大，耦合了大量 UI 状态与交互，结构性重构缺少可控边界。
- `TaskQueue` 当前实现存在 waiter 生命周期与停机行为隐患：waiter 可能无限增长；stop 时不追踪/取消 in-flight tasks，可能在资源关闭后继续运行。
- 生产后端镜像为了瘦身采取“先安装再卸载 chromadb 及其依赖”的策略，维护成本高且容易误删导致隐性运行时问题。
- `pnpm-workspace.yaml` 被 `.gitignore` 忽略导致 clone 后行为不一致，影响复现性。

约束：

- 对外 API 路径与 OpenAPI 合约保持稳定（尽量不产生 schema diff）。
- 本次不引入新的 CI 门禁；以最小侵入方式降低风险。

## Goals / Non-Goals

**Goals:**

- 将超大模块拆分为更小、职责单一、可测试的子模块，减少单次改动影响范围。
- 为后端与前端建立更清晰的“模块边界/职责分层”规则，并反映到规范中。
- 修复 `TaskQueue` 的资源与生命周期问题，使长跑更稳定、停机更可控。
- 用 uv 的能力在 Docker 构建阶段避免“安装后卸载”，降低镜像维护风险。
- 修复 `pnpm-workspace.yaml` 的版本控制问题，保证开发环境一致性。

**Non-Goals:**

- 不调整现有 HTTP 路由路径、不新增/删除对外 API 功能（除非为保持兼容做内部迁移/薄封装）。
- 不引入新的强制 lint/format/CI 工作流门禁（可在后续 change 单独推进）。
- 不处理密钥泄露/历史清理（单独议题）。

## Decisions

### 1) 后端：保持 `features/<feature>/api.py` 入口稳定，采用“薄入口 + 子模块”拆分

**Decision:** 保留 `crystalith/features/sources/api.py` 文件作为对外路由入口（保持 `web/routers.py` 的 import 路径不变），将实现迁移到同目录下的若干子模块（例如 `api_tags.py`、`api_ingest.py`、`api_search.py`、`api_qa.py`、`api_summary.py`、`api_batch.py`）。

**Rationale:**

- 将 `api.py` 直接改为 package（`api/__init__.py`）会破坏现有 import 路径，带来更大迁移面与潜在循环导入。
- 保持入口稳定，可以在不影响外部调用的前提下逐步搬迁内部实现。

**Alternatives:**

- A) 将 `api.py` 改为 package 并更新 `web/routers.py`：更“干净”，但迁移面大，且容易引入 import 断裂。
- B) 完全不拆分，仅增加注释/折叠：无法实质降低复杂度与回归风险。

### 2) 后端：统一 Pydantic schema 的归属与复用策略

**Decision:** sources feature 内部区分两类模型：

- 领域稳定模型放入 `schemas.py`（对多个端点复用，且长期稳定）
- 端点专用 request/response 放入 `api_schemas.py`（或拆到各子模块内的 `*_schemas.py`）

并消除重复定义（例如 `SourceRead` 在多个文件的重复版本），优先以“单一来源”导出。

**Rationale:**

- 目前 `api.py` 内部同时定义大量 request/response，且与 `schemas.py` 存在重复/相近结构，容易产生不一致与维护成本。

### 3) 前端：按 domain 维度拆分，并引入“容器/展示组件”边界

**Decision:** 对 workspace 大组件采用渐进式拆分：

- 保持对外导出组件名与 props 接口不变（尽量避免跨域改动）。
- 将纯展示 UI 与状态/副作用逻辑分离：
  - 展示组件放 `domains/<domain>/components/`
  - 领域 hooks/状态逻辑放 `domains/<domain>/hooks/` 或维持现有 `useX.ts`
  - 跨域共享逻辑继续放 `features/workspace/shared/`

**Rationale:**

- 大文件拆分的主要收益来自“变更半径与可测试性”而非目录美观；保持接口稳定可降低迁移风险。

### 4) TaskQueue：waiter 延迟创建 + in-flight 追踪 + 停机可控

**Decision:** 调整 TaskQueue 的内部生命周期策略：

- waiter **不在 enqueue 时创建**，仅在 `wait_for_completion()` 被调用时创建（lazy waiter），任务完成/取消时只在 waiter 存在时通知。
- 追踪 in-flight worker task 集合，stop 时统一 cancel 并 await，避免资源关闭后任务继续执行。
- 在 worker 完成时进行必要的清理（包括 waiter、in-flight 集合）。

**Rationale:**

- 当前 waiter 在 enqueue 时无条件创建，且调用方不一定 wait，导致 dict 长期增长。
- 当前 stop 仅取消主 loop，不处理已启动的 worker；在服务重载/关闭时可能出现悬挂任务。

### 5) Docker / uv：用 `uv sync --no-install-package` 替代“安装后卸载”

**Decision (recommended):** 保持 `backend/py/pyproject.toml` 对开发默认体验不变；在生产 Docker 构建阶段使用：

- `uv sync --frozen --no-dev --no-editable --no-install-package chromadb`

从源头避免安装 embedded Chroma 依赖，从而删除 Dockerfile 中的卸载清单。

**Rationale:**

- 生产 compose 配置使用 `CHROMA_HOST=chromadb`，运行时走 `ChromaHttpVectorStore`，不依赖 `chromadb` Python 包；因此在镜像中跳过安装是安全且更干净的。
- 比“移动依赖到 extras”更低风险：不会改变本地默认安装行为。

**Alternatives:**

- A) 将 `chromadb` 移到 optional extras / dependency group：更“语义化”，但会改变默认安装体验，需同步调整默认配置与文档。

### 6) pnpm-workspace.yaml：纳入版本控制

**Decision:** 移除 `.gitignore` 中对 `pnpm-workspace.yaml` 的忽略，并将 `frontend/web/pnpm-workspace.yaml` 作为仓库受控文件提交。

**Rationale:**

- 该文件存在但被忽略会造成“在我机器上可以”的隐性差异；纳管后可保证 clone 一致性。

## Risks / Trade-offs

- [大文件拆分引入回归] → 采取“入口不变、逐段迁移、保持路由与 schema 不变”的策略；优先拆纯函数与纯展示组件；对关键行为补充单测。
- [拆分导致循环导入] → 明确子模块只向下依赖（api -> service/repo/shared），避免子模块互相运行时导入；必要时抽取 shared helper。
- [TaskQueue 行为变更影响调用方] → 保持 public API 不变；用单测覆盖 enqueue/wait/stop 的关键边界（未 wait 的任务、stop 时进行中的任务等）。
- [Docker 构建跳过 chromadb 导致某些配置下不可用] → 在设计中明确：生产镜像只支持 external Chroma（HTTP）；如需 embedded Chroma，使用开发镜像/本地运行并安装 chromadb。

## Migration Plan

- Backend sources：先抽取 schema 与 helper，再按端点聚类迁移到子模块，最后将 `api.py` 收敛为“router + include 子模块”。
- Frontend：优先从 `WorkspaceLayout` 中抽取纯 UI 子组件与 utilities；再逐个 panel 拆分，保持对外导出接口不变。
- TaskQueue：先调整 waiter 生命周期与 in-flight 追踪；补单测；再在实际运行路径验证 stop 行为。
- Docker：先在 CI/本地构建验证 `uv sync --no-install-package chromadb` 可用；移除卸载清单；确认运行时走 HTTP Chroma 路径。
- Repo：移除 `.gitignore` 忽略并提交 `frontend/web/pnpm-workspace.yaml`。

## Open Questions

- sources 与其他 feature 是否也需要同样的拆分策略（research/qa 等同样存在大文件）？本 change 是否仅对最痛点模块动刀，还是引入统一阈值/规则并逐步推进？
- `uv sync --no-install-package` 在目标构建环境上的行为是否稳定（含 lockfile 与平台差异）？是否需要补充 Docker 构建说明与回退方案？
