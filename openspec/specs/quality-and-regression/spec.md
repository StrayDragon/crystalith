# quality-and-regression Specification

## Purpose

定义工程质量门槛：CI 流水线、回归冒烟、评测基线与测试稳定性约束。该规范旨在让关键回归尽早暴露并可在本地与 CI 中一致复现。

## Non-goals

- 不定义具体业务功能
- 不定义部署拓扑
## Requirements
### Requirement: CI runs on push and pull_request
CI MUST 在 push/PR 触发并提供可见状态检查。

#### Scenario: CI status is visible on PR
- **WHEN** 开发者提交 PR 或 push 新提交
- **THEN** CI SHALL 触发并在 PR/提交上提供可见状态检查

### Requirement: Backend and frontend verification are mandatory
CI MUST 执行后端测试与前端测试+构建。

#### Scenario: CI runs backend and frontend checks
- **WHEN** CI 运行验证流程
- **THEN** 系统 SHALL 执行后端测试与前端测试+构建（或等价验证）

### Requirement: API/codegen/schema drift checks are mandatory
CI MUST 检查 OpenAPI、生成客户端、配置 schema、docs 受控生成物/注入区块与导入分层一致性。

#### Scenario: Drift causes CI failure
- **WHEN** OpenAPI/生成客户端/配置 schema/docs 受控生成物/注入区块/导入分层与仓库内容不一致
- **THEN** CI SHALL 检测到漂移并失败提示

### Requirement: Local default test entrypoints include guardrails
本地默认测试入口 MUST 覆盖关键 guardrail 检查，避免问题仅在 CI 暴露。

#### Scenario: Local test entrypoints run guardrails
- **WHEN** 开发者在本地运行默认测试入口（如 `just test` 或等价）
- **THEN** 系统 SHALL 同时运行关键 guardrail 检查并在失败时返回非 0

### Requirement: Lint and contract checks are part of the quality gate
CI 与本地默认检查入口 MUST 覆盖 lint、格式化检查与关键 API contract checks，以降低回归风险。

#### Scenario: Local checks match CI guardrails
- **WHEN** 开发者在本地运行默认检查入口（例如 `just check` 或等价）
- **THEN** 该入口 SHALL 覆盖 lint、format check 与关键 contract checks
- **AND** 在失败时返回非 0 并给出可执行的修复建议

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

### Requirement: Backend Python lint catches low-noise footguns
后端 Python lint MUST 覆盖“低噪音高收益”的问题类型，以在不引入风格争议的前提下降低回归风险。

#### Scenario: Backend lint enforces low-noise rules
- **WHEN** 非测试代码引入内置名遮蔽、naive datetime 或未使用参数等问题
- **THEN** lint SHALL 失败并给出可定位的诊断信息

#### Scenario: Test code allows unused arguments
- **WHEN** 测试代码（`**/tests/**`）因 pytest fixture/参数化存在未使用参数
- **THEN** lint SHALL 允许该类未使用参数存在

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
- **AND** MAY 通过一次受控的全量格式化建立统一风格基线

### Requirement: Minimal API smoke regression suite exists
仓库 MUST 维护核心 API 冒烟回归清单并可执行。

#### Scenario: Run smoke regression suite
- **WHEN** 执行核心 API 冒烟回归清单
- **THEN** 系统 SHALL 能稳定运行并覆盖最小关键路径

### Requirement: LLM evaluation harness has stable dataset and metrics
评测流程 MUST 定义数据格式与关键回归指标并输出可比报告。

#### Scenario: LLM eval produces comparable report
- **WHEN** 运行 LLM 评测流程
- **THEN** 系统 SHALL 产出可比报告并包含关键回归指标

### Requirement: Timing-sensitive tests are deterministic
计时相关测试 MUST 使用可控时间（fake timer/clock）而非真实 wall-clock 阈值。

#### Scenario: Timing tests do not flake
- **WHEN** 运行计时敏感的单元/集成测试
- **THEN** 测试 SHALL 使用可控时间源以避免 wall-clock 引入不稳定

### Requirement: Tests minimize brittle mocks and align with real implementations
后端测试 MUST 尽可能对齐真实实现与真实 wiring，并避免通过 patch 内部实现细节来达成可控性；当确需可控时，系统 MUST 提供显式 seam（依赖注入、可替换 provider/transport）供测试使用。

#### Scenario: Test controls external dependencies via explicit seams
- **WHEN** 测试需要隔离网络/第三方服务/宿主环境等外部边界
- **THEN** 测试 SHALL 使用显式 seam（例如 transport/provider/clock）进行隔离
- **AND** 测试 SHALL 避免 patch 私有符号（`_xxx`）来替换内部实现

#### Scenario: Backend quality gate rejects private patches
- **WHEN** 开发者运行后端默认质量门槛（例如 `cd backend/py && just test`）
- **AND** 测试代码存在对私有符号（`_xxx`）的 patch
- **THEN** 质量门槛 SHALL 失败并给出可定位的诊断信息（不允许 allowlist）

#### Scenario: Backend quality gate requires Mock reason for monkeypatch usage
- **WHEN** 开发者运行后端默认质量门槛（例如 `cd backend/py && just test`）
- **AND** 某测试文件使用 `monkeypatch.*` 改变运行行为
- **AND** 该文件未包含任何 `Mock reason:` 注释
- **THEN** 质量门槛 SHALL 失败并给出可定位的诊断信息

### Requirement: Test-double usage is observable via a stable report
仓库 MUST 提供稳定的 test doubles 使用报告入口，以便识别 brittle mocks、热点文件与迁移目标，并支持本地与 CI 环境复现。

#### Scenario: Developer can run a deterministic report
- **WHEN** 开发者运行后端测试替身使用报告入口（例如 `just test-mock-report`）
- **THEN** 系统 SHALL 输出确定性的统计与迁移导航信息（私有 patch、缺少 `Mock reason:` 的位置、hotspots）

### Requirement: Backend test suites are tiered and reproducible
后端测试 MUST 明确区分“核心回归链路”与“边缘/试验性用例”，以便在不追求机械 KPI 覆盖率的前提下，稳定守住关键路径并降低 flaky 风险。

#### Scenario: Default backend quality gate excludes experimental tests
- **WHEN** 开发者运行默认后端质量门槛（例如 `cd backend/py && just test`）
- **THEN** 系统 SHALL 运行所有未标记为 `experimental` 的测试用例
- **AND** `experimental` 用例 SHALL 仅在显式入口（例如 `just test-all`）或单独流水线中运行

#### Scenario: Core regression suite is executable and deterministic
- **WHEN** 开发者运行核心回归套件（例如 `cd backend/py && just test-core`）
- **THEN** 系统 SHALL 仅运行标记为 `core` 的测试用例（允许通过 marker 或路径约定自动打标）
- **AND** SHALL 设置稳定的执行环境（例如 `PYTHONHASHSEED=0`、`TZ=UTC`）
- **AND** core 套件 SHALL 默认禁止外部网络访问（仅允许 localhost），以保证可复现与可审计

#### Scenario: Tests opt into experimental explicitly
- **WHEN** 新增/修改边缘或试验性的测试用例
- **THEN** 该测试 SHOULD 显式标注 `@pytest.mark.experimental`
- **AND** 默认质量门槛 SHALL 不因该类用例的不稳定而阻塞核心回归链路
