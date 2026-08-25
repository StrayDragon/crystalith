# language: zh-CN
# capability: quality-and-regression
# purpose: 定义 v2 工程质量门槛：以 just qa 为主 PR 门禁，覆盖 typecheck/lint/format、配置漂移、server/shared 单测、web Vitest 与 Playwright @p0；BDD 与 type-aware lint 为可选。
# scope: apps/, packages/, e2e/, scripts/

功能: quality-and-regression

  @req:r204 @human
  场景: Lint and format are part of the quality gate
    - 本地与 PR 主门禁 MUST 覆盖 oxlint 与 oxfmt 检查（just check / just qa 的 check 段）。

  @req:r232 @human
  场景: Frontend JS/TS lint uses Oxc entrypoints
    - 前端与仓库 JS/TS lint MUST 通过根 bun lint（oxlint）提供；apps/web MAY 另提供 lint / lint:all 增量与全量入口。

  @req:r266 @human
  场景: Formatting uses Oxfmt
    - 格式化检查 MUST 使用 oxfmt（bun format:check / just format-check），生成产物按工具配置排除。

  @req:r99 @human
  场景: Backend and frontend verification are mandatory in primary gate
    - 主门禁 just qa MUST 执行 server+shared 单元/集成测试（just test）与前端 Vitest CI（just test-web / apps/web test:ci）。

  @req:r10 @human
  场景: Critical browser smoke exists
    - 仓库 MUST 维护 Playwright @p0 冒烟（just e2e），并纳入 just qa。

  @req:r136 @human
  场景: Config schema and env example drift checks are mandatory
    - just qa MUST 运行 check-env-examples 与 check-app-schema（Zod SSOT → .env.example / secret.env.example / app.schema.gen.json）。

  @req:r172 @human
  场景: Local default unit entrypoints are scoped
    - just test MUST 仅覆盖 apps/server/tests/ 与 packages/shared/test/；完整 PR 验证 MUST 使用 just qa（含 web Vitest 与 e2e）。

  @req:r16 @human
  场景: Frontend test suites are tiered and reproducible
    - 前端稳定套件（test:ci）MUST 默认禁止未处理真实网络（MSW onUnhandledRequest=error），并运行 mock-reason 门禁（test-mock-report-check）。核心子集 MAY 通过 test:core 单独运行。

  @req:r14 @human
  场景: Frontend test-double usage is observable
    - 仓库 MUST 提供前端 test doubles 报告入口（apps/web test-mock-report / test-mock-report-check），并在 test:ci 中执行 check。

  @req:r41 @human
  场景: Remote CI status checks are optional
    - 仓库 MAY 提供 GitHub Actions 等远程 CI；在未提供 workflows 时，贡献者 MUST 以本地 just qa 作为 PR 自检门禁。MUST NOT 假定 push/PR 上已有强制 CI 状态检查。

  @req:r_bdd_optional @human
  场景: BDD and type-aware lint are out of primary gate
    - just test-bdd 与 just type-aware-lint MUST NOT 作为 just qa 的硬性组成部分；BDD 为 CRUD 子集可选回归，type-aware lint 为 advisory。

  @req:r204 @human
  场景: local-checks-match-gate
    - 必须成立：当 开发者运行 just check；那么 SHALL 覆盖 typecheck、oxlint 与 oxfmt check
    当 开发者运行 just check
    那么 SHALL 覆盖 typecheck、oxlint 与 oxfmt check

  @req:r232 @human
  场景: repo-oxlint-entrypoint
    - 必须成立：当 开发者运行 bun lint；那么 SHALL 对受管源码执行 oxlint
    当 开发者运行 bun lint
    那么 SHALL 对受管源码执行 oxlint

  @req:r266 @human
  场景: format-check-entrypoint
    - 必须成立：当 开发者运行 bun format:check；那么 SHALL 使用 oxfmt 校验格式
    当 开发者运行 bun format:check
    那么 SHALL 使用 oxfmt 校验格式

  @req:r99 @human
  场景: qa-runs-server-and-web-tests
    - 必须成立：当 开发者运行 just qa；那么 SHALL 执行 just test 与 just test-web
    当 开发者运行 just qa
    那么 SHALL 执行 just test 与 just test-web

  @req:r10 @human
  场景: qa-runs-p0-e2e
    - 必须成立：当 开发者运行 just qa；那么 SHALL 执行 Playwright @p0（just e2e）
    当 开发者运行 just qa
    那么 SHALL 执行 Playwright @p0（just e2e）

  @req:r136 @human
  场景: env-schema-drift-fails-qa
    - 必须成立：当 .env.example 或 app.schema.gen.json 与 Zod SSOT 不一致；那么 just qa SHALL 在 drift check 失败并退出非 0
    当 .env.example 或 app.schema.gen.json 与 Zod SSOT 不一致
    那么 just qa SHALL 在 drift check 失败并退出非 0

  @req:r172 @human
  场景: just-test-is-unit-subset
    - 必须成立：当 开发者仅运行 just test；那么 SHALL 不自动跑 web Vitest 或 e2e
    当 开发者仅运行 just test
    那么 SHALL 不自动跑 web Vitest 或 e2e

  @req:r16 @human
  场景: frontend-stable-rejects-unhandled-network
    - 必须成立：当 稳定套件触发未被 MSW 覆盖的请求；那么 测试 SHALL 失败
    当 稳定套件触发未被 MSW 覆盖的请求
    那么 测试 SHALL 失败

  @req:r16 @human
  场景: frontend-ci-requires-mock-reason
    - 必须成立：当 稳定测试使用 vi patch 却缺少 Mock reason；那么 test:ci SHALL 失败
    当 稳定测试使用 vi patch 却缺少 Mock reason
    那么 test:ci SHALL 失败

  @req:r14 @human
  场景: frontend-mock-report-runs
    - 必须成立：当 开发者运行 cd apps/web && bun run test-mock-report；那么 SHALL 输出确定性统计
    当 开发者运行 cd apps/web && bun run test-mock-report
    那么 SHALL 输出确定性统计

  @req:r41 @human
  场景: local-qa-is-pr-self-check
    - 必须成立：当 仓库尚无 GitHub Actions workflow；那么 PR 模板 SHALL 要求勾选本地 just qa
    当 仓库尚无 GitHub Actions workflow
    那么 PR 模板 SHALL 要求勾选本地 just qa

  @req:r_bdd_optional @human
  场景: bdd-not-in-qa
    - 必须成立：当 开发者运行 just qa；那么 SHALL 不执行 just test-bdd
    当 开发者运行 just qa
    那么 SHALL 不执行 just test-bdd

  @req:r_bdd_optional @human
  场景: type-aware-advisory
    - 必须成立：当 开发者运行 just type-aware-lint；那么 结果 MAY 失败且不阻塞 just qa
    当 开发者运行 just type-aware-lint
    那么 结果 MAY 失败且不阻塞 just qa
