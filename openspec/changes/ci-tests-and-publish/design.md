## Context

当前仓库缺少面向 PR 的统一 CI 门禁：后端/前端单测、前端构建、以及 OpenAPI 与生成客户端的一致性校验没有自动化保障。仓库仅存在与 Python SDK 相关的 workflow（check/release），这不足以支撑 public 发布后的协作与回归控制。

现状与约束：

- 后端依赖管理使用 uv（`backend/py/uv.lock`），测试入口为 `cd backend/py && just test`。
- 前端使用 pnpm（`frontend/web/pnpm-lock.yaml`），测试入口为 `pnpm test`，构建入口为 `pnpm run build`。
- 已存在 API schema 工具：`backend/py/scripts/api_schema.py`，以及前端生成命令：`pnpm run api:generate`。
- 希望 CI 先覆盖“必需可验证”的最小闭环；更重的质量工具（lint/coverage/security scan）可作为后续增强。

## Goals / Non-Goals

**Goals:**

- 提供 PR/push 触发的 CI workflow，覆盖：
  - 后端依赖安装 + 单测
  - 前端依赖安装 + 单测 + 构建
  - OpenAPI 与生成客户端一致性校验（防止漂移）
- 为 Python SDK 发布增加“发布前校验”（至少保证 SDK 与 OpenAPI 同步）。
- 使 CI 可维护：命令入口尽量复用 `justfile` 与已有脚本，避免在 workflow 中复制复杂逻辑。

**Non-Goals:**

- 不在本变更中要求补齐所有业务测试覆盖率（测试增量可另拆 change）。
- 不在本变更中强制引入新的代码格式化/静态检查/类型检查门禁（ruff/eslint/mypy/tsc 等）。
- 不在本变更中引入自动发版（tag push 自动发布）策略；仍以手动触发为主，先保证“可控与可审计”。

## Decisions

### 1) CI 形态：单一主 workflow + 并行 jobs

**Decision:** 新增 `.github/workflows/ci.yml`（命名可在实现阶段确认），在 `push` 与 `pull_request` 上运行；拆分为 backend/frontend 两个并行 job：

- backend job 负责：后端单测 + OpenAPI schema check +（可选）仓库级一致性检查（如 compose 同步检查）
- frontend job 负责：前端单测 + 构建 + 生成客户端 diff-check

**Rationale:** 并行可降低总耗时；分 job 便于定位失败原因与后续扩展（例如加入 lint/coverage）。

### 2) 工具链对齐：Python 3.12 + Node 20 + uv/pnpm

**Decision:** CI 统一使用 Python 3.12 与 Node 20（与现有 SDK workflows 一致），并分别使用 uv 与 pnpm 安装依赖。

**Alternatives:**

- 使用系统 pip + requirements：与现有锁文件不一致，降低可复现性。
- 使用 npm/yarn：与仓库 `packageManager` 声明不一致。

### 3) 一致性校验策略：用现有脚本做“check”，用 git diff 判定生成产物漂移

**Decision:**

- OpenAPI 一致性使用 `uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json`。
- 前端生成客户端一致性：运行 `pnpm run api:generate` 后检查 `git diff`（或等价方式）确保无变更。

**Rationale:** 复用已有入口，避免在 CI 中实现新的“对比逻辑”；并把“生成产物必须提交”作为明确约束。

### 4) Python SDK freshness check：独立 check workflow（不含发布逻辑）

**Decision:** 新增 `check-python-sdk.yml`，在 CI 中执行 `just api-check` + `just sdk-check`，以保证仓库内的 Python SDK 生成产物与当前 OpenAPI/后端版本保持一致；不在此变更中实现 PyPI 发布自动化。

**Rationale:** freshness check 能显著降低“生成产物漂移”风险，且不引入发包所需的额外权限/机密配置与维护成本。

### 5) 质量门禁范围：先做最小闭环，不加 coverage/security/lint/type-check

**Decision:** 本变更仅引入“测试 + 构建 + 合同一致性”最小闭环，不新增以下门禁：

- ruff / eslint / mypy / tsc
- 覆盖率上传与 PR 评论展示
- 依赖安全扫描（pip-audit / npm audit）与定时任务

**Rationale:** 这些门禁通常需要额外工具与规则收敛，容易演变为一次性大规模整改；先把“可验证的最低门槛”跑通，再用独立 change 渐进增强。

### 6) 生成器版本固定：Pin Fern CLI 版本

**Decision:** 在 CI/workflow 中使用固定版本的 Fern CLI：`fern-api@3.73.1`（通过 `npm install -g fern-api@3.73.1`），避免“上游更新导致生成 diff”。

**Rationale:** Fern CLI 安装目前是 `npm install -g fern-api`（latest），存在不确定性；固定版本可提升可复现性与可审计性。

### 7) Docs-only changes do not trigger CI

**Decision:** 在主 CI workflow 中配置 `paths-ignore`（例如 `docs/**`、`openspec/**`、`**/*.md` 等），使仅修改文档/规格时不触发 CI。

**Rationale:** 降低噪声与 CI 资源消耗；文档类变更由 docs workflow（若存在）负责验证构建。更细粒度的 job 级 path filter（只跑受影响的 job）暂不引入，避免维护规则复杂化。

## Risks / Trade-offs

- [CI 时间过长影响迭代] → jobs 并行 + 缓存（uv cache、pnpm store cache）；并对 docs-only changes 使用 `paths-ignore` 降噪。
- [生成代码非确定性导致“永远有 diff”] → 固定生成器版本（锁定依赖/全局工具版本），必要时在生成前清理输出目录并确保稳定排序。
- [GitHub Pages 等需要额外权限配置] → 在文档中明确需要的 permissions/environment。

## Migration Plan

1. 新增主 CI workflow 并在 PR 上验证触发与通过/失败行为。
2. 把 API consistency 与生成客户端 diff-check 接入主 CI。
3. 新增 Python SDK check workflow：加入 freshness check，确保生成产物与 schema 同步。
4. 更新文档：说明 CI 约束（例如“修改后端 API 必须同步生成 openapi.json 与前端 client”）。

## Open Questions

- 是否需要引入更细粒度的 job 级 path filters（例如仅改前端时跳过 backend job），以减少 CI 用量与等待时间？
- 是否需要增加 Playwright E2E job（建议：`workflow_dispatch`/nightly 为主，避免把 PR 门禁变重）？
- 是否需要把 lint/type-check（ruff/eslint/mypy/tsc）作为独立变更引入到 CI（与现有最小闭环解耦）？
