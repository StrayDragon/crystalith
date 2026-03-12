## ADDED Requirements

### Requirement: Frontend JS/TS lint uses Oxc entrypoints
前端 JS/TS lint 工作流 MUST 统一通过 `oxlint` 提供，并同时保留增量入口与全量入口，以兼顾日常反馈速度与全量可见性。

#### Scenario: Incremental frontend lint targets changed files
- **WHEN** 开发者运行 `pnpm -C frontend/web run lint`
- **THEN** 系统 SHALL 仅对前端已修改/新增的手写源码执行 `oxlint`
- **AND** 默认以 `origin/main` 为比较基线
- **AND** 在缺少该基线时 SHALL 至少覆盖本地 staged / unstaged / untracked 变化

#### Scenario: Full frontend lint remains runnable on repository baseline
- **WHEN** 开发者运行 `pnpm -C frontend/web run lint:all`
- **THEN** 系统 SHALL 对前端受管源码执行 `oxlint` 全量检查
- **AND** 历史 warning SHALL 可见但不要求立即全部修复后才能运行该入口

### Requirement: Frontend formatting uses Oxfmt with generated files excluded
前端格式化工作流 MUST 使用 `oxfmt` 提供统一写入与检查入口，并排除生成产物与第三方内容。

#### Scenario: Format check targets hand-authored frontend files only
- **WHEN** 开发者运行 `pnpm -C frontend/web run format:check`
- **THEN** 系统 SHALL 使用 `oxfmt` 校验前端手写源码与关键配置文件的格式
- **AND** SHALL 排除 `src/api/generated/**`、`openapi.gen.json`、lock 文件与 vendor 内容

#### Scenario: Full frontend format converges repository style
- **WHEN** 仓库首次引入 `oxfmt`
- **THEN** 迁移 SHALL 对受管前端文件执行一次全量格式化收敛
- **AND** 后续变更 SHALL 可通过 `format:check` 稳定复现相同结果

## MODIFIED Requirements

### Requirement: Lint and contract checks are part of the quality gate
CI 与本地默认检查入口 MUST 覆盖 lint、格式化检查与关键 API contract checks，以降低回归风险。

#### Scenario: Local checks match CI guardrails
- **WHEN** 开发者在本地运行默认检查入口（例如 `just check` 或等价）
- **THEN** 该入口 SHALL 覆盖 lint、format check 与关键 contract checks
- **AND** 在失败时返回非 0 并给出可执行的修复建议

### Requirement: Lint adoption is incremental and actionable
lint 引入 MUST 采用增量策略，避免一次性全仓重写导致评审噪声与维护成本爆炸；formatter 引入 MAY 在初次迁移时执行一次受控的全量收敛，以建立稳定基线。

#### Scenario: Incremental lint and controlled formatter rollout coexist
- **WHEN** 仓库引入新的前端 lint / format 工具链
- **THEN** 系统 SHALL 优先对新增/变更代码严格执行日常 lint
- **AND** MAY 通过一次受控的全量格式化建立统一风格基线
