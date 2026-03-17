## Context

仓库已采用：
- Backend：Ruff 作为 Python lint 基线（并已对 FastAPI 的 `Depends(...)` 默认参数等做了合理例外）。
- Frontend：`oxlint` + `oxfmt` 作为 JS/TS 的 lint/format 工具链，并同时提供增量与全量入口。

但在当前基线之上，仍有一些“高收益低噪音”的规则类别未被覆盖或未被持续 gate，例如：
- Python：内置名遮蔽（`A`）、生产代码中未使用参数（`ARG`）、naive datetime（`DTZ`）。
- Frontend：`suspicious` + `perf` 类别下的一些明显风险写法。

本设计关注如何把这些规则纳入日常质量门槛，同时避免一次性引入大量历史遗留噪音。

## Goals / Non-Goals

**Goals:**
- 仅引入信噪比高、容易达成一致的规则集（“更像 bug 的问题”优先）。
- 保持增量 lint 入口的速度与可用性，并确保全量入口在主分支基线上稳定通过。
- 对测试代码保留必要的弹性（例如 pytest fixture/参数化常见的未使用参数）。

**Non-Goals:**
- 不启用 `ruff --select=ALL` 或 oxlint 的 `pedantic/style/restriction` 等高噪音类别。
- 不做与 lint 无关的重构/格式化收敛（除非是修复 lint 所必需）。
- 不要求在每个 TSX 文件中显式 `import React`（与现代 JSX transform 冲突）。

## Decisions

### 1) Backend：Ruff 扩展 `A/ARG/DTZ`

- 在 `backend/py/pyproject.toml` 的 Ruff 基线之上增加 `A`, `ARG`, `DTZ`。
- 对所有测试目录（`**/tests/**/*.py`）忽略 `ARG*`，允许测试中存在未使用参数，以适配 pytest fixture/参数化。
- 非测试代码中若存在未使用参数，优先做“显式消除”：
  - 删除未使用参数；或
  - 将参数改为 `_` / `_name` 以表达“有意未使用”。

### 2) Frontend：oxlint 启用 `suspicious + perf`，并放行 `react-in-jsx-scope`

- 在 `pnpm -C frontend/web run lint`（增量）与 `lint:all`（全量）中启用：
  - `-D suspicious -D perf`：开启低噪音的可疑与性能规则。
  - `-A react-in-jsx-scope`：避免过时规则导致的全量噪音（React 17+ / 19 不需要显式 `import React`）。
- 其余规则保持最小集，避免引入风格偏好型争议。

### 3) 引入策略：先清基线，再收紧 gate

- 新规则启用后，主分支基线 MUST 保持 `ruff check` 与 `pnpm run lint:all` 通过（零 error，warnings 也按 gate 处理）。
- 对于确有必要的例外，采用最小范围的 per-file ignore 或局部 disable（并在代码中解释原因）。

## Risks / Trade-offs

- `react(no-array-index-key)`：部分列表组件可能缺少稳定 key，需要补齐业务唯一标识或做有界 disable。
- `no-await-in-loop`：可能触发局部重构（批量并发、串行语义保持等），需避免引入行为变化。
- `DTZ*`：修复 naive datetime 需要明确时区语义（UTC/本地），避免“修 lint 反而改语义”。

## Migration Plan

1. 先落地配置变更（Ruff + oxlint），在 CI/本地入口中可复现。
2. 修复主分支基线上的违规点（优先自动修复，其次小步手工修复）。
3. 追加最小范围例外（仅在确有必要时），并记录在变更说明与代码注释中。

## Resolved Questions

- `ARG*` 放宽范围：覆盖所有 `**/tests/**`（包含 `backend/py/packages/**/tests/**`）。
- `no-await-in-loop` 处理策略：
  - 若语义允许并发：优先改为 `Promise.all` / `Promise.allSettled`；
  - 若必须串行（例如逐项进度更新 + 取消、或 dedup/confirm 交互）：允许最小范围的局部 disable，并在代码中说明理由。
