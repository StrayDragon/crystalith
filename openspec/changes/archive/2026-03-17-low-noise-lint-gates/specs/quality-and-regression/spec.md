# quality-and-regression Specification

## MODIFIED Requirements

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
- **AND** 该入口 SHALL 在主分支基线保持零 error（并将 warnings 视为 gate），避免质量门槛漂移
- **AND** 若引入新规则导致历史遗留噪音，系统 MUST 先以受控方式（一次性收敛或最小范围 ignore）清理基线后再开启 gate

### Requirement: Lint adoption is incremental and actionable
lint 引入 MUST 采用增量策略，避免一次性全仓重写导致评审噪声与维护成本爆炸；formatter 引入 MAY 在初次迁移时执行一次受控的全量收敛，以建立稳定基线。

#### Scenario: Lint focuses on changed files first
- **WHEN** lint 新规则引入到仓库
- **THEN** 系统 SHALL 优先对新增/变更代码严格执行
- **AND** 对历史遗留问题 MUST 提供基线清零或显式 ignore 的过渡机制

#### Scenario: Incremental lint and controlled formatter rollout coexist
- **WHEN** 仓库引入新的前端 lint / format 工具链或升级规则集
- **THEN** 系统 SHALL 优先对新增/变更代码严格执行日常 lint
- **AND** 仅在主分支基线已清零后，相关入口才 MAY 升级为“warnings 也视为 gate”的严格模式

## ADDED Requirements

### Requirement: Backend Python lint catches low-noise footguns
后端 Python lint MUST 覆盖“低噪音高收益”的问题类型，以在不引入风格争议的前提下降低回归风险。

#### Scenario: Backend lint enforces low-noise rules with test exceptions
- **WHEN** 非测试代码引入内置名遮蔽、naive datetime 或未使用参数等问题
- **THEN** lint SHALL 失败并给出可定位的诊断信息
- **AND** **WHEN** 测试代码（`**/tests/**`）因 pytest fixture/参数化存在未使用参数
- **THEN** lint SHALL 允许该类未使用参数存在
