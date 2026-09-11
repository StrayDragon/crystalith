# language: zh-CN
# capability: quality-and-regression
# purpose: 定义 v2 工程质量门槛：以 just qa 为主 PR 门禁，覆盖 typecheck/lint/format、配置漂移、server/shared 单测、web Rstest 与 Playwright @p0；BDD 与 type-aware lint 为可选。
# scope: apps/, packages/, e2e/, scripts/

功能: quality-and-regression

  @req:r204 @human
  场景: Lint and format are part of the quality gate
    - 本地与 PR 主门禁 MUST 覆盖 typecheck 与 oxlint、oxfmt 检查（just check / just qa 的 check 段）。

  @req:r232 @human
  场景: Frontend JS/TS lint uses Oxc entrypoints
    - 前端与仓库 JS/TS lint MUST 通过根 bun lint（oxlint）提供；apps/web MAY 另提供 lint / lint:all 增量与全量入口。

  @req:r266 @human
  场景: Formatting uses Oxfmt
    - 格式化检查 MUST 使用 oxfmt（bun format:check / just format-check），生成产物按工具配置排除。

  @req:r99 @human
  场景: Backend and frontend verification are mandatory in primary gate
    - 主门禁 just qa MUST 执行 server+shared 单元/集成测试（just test）与前端 Rstest CI（just test-web / apps/web test:ci）。本条为 just qa 测试面组成的 canonical 约束。

  @req:r10 @human
  场景: Critical browser smoke exists
    - 仓库 MUST 维护 Playwright @p0 冒烟（just e2e），并纳入 just qa。

  @req:r136 @human
  场景: Config schema and env example drift checks are mandatory
    - just qa MUST 运行 check-env-examples 与 check-app-schema（Zod SSOT → .env.example / secret.env.example / app.schema.gen.json）；任一检查发现与 Zod SSOT 不一致时，just qa SHALL 失败并以非 0 退出。

  @req:r172 @human
  场景: Local default unit entrypoints are scoped
    - just test MUST 仅覆盖 apps/server/tests/ 与 packages/shared/test/（不自动运行 web Rstest 或 e2e）；完整 PR 验证 MUST 使用 just qa（含 web Rstest 与 e2e）。本条为本地默认测试入口范围的 canonical 约束。

  @req:r16 @human
  场景: Frontend test suites are tiered and reproducible
    - 前端稳定套件（test:ci）MUST 默认禁止未处理真实网络（MSW onUnhandledRequest=error，触发未被 MSW 覆盖的请求时测试 SHALL 失败），并运行 mock-reason 门禁（test-mock-report-check，稳定测试缺少 Mock reason 时 test:ci SHALL 失败）。核心子集 MAY 通过 test:core 单独运行。

  @req:r14 @human
  场景: Frontend test-double usage is observable
    - 仓库 MUST 提供前端 test doubles 报告入口（apps/web test-mock-report / test-mock-report-check，输出确定性统计），并在 test:ci 中执行 check。

  @req:r41 @human
  场景: Remote CI status checks are optional
    - 仓库 MAY 提供 GitHub Actions 等远程 CI；在未提供 workflows 时，贡献者 MUST 以本地 just qa 作为 PR 自检门禁（PR 模板 SHALL 要求勾选本地 just qa），MUST NOT 假定 push/PR 上已有强制 CI 状态检查。

  @req:r_bdd_optional @human
  场景: BDD and type-aware lint are out of primary gate
    - just test-bdd 与 just type-aware-lint MUST NOT 作为 just qa 的硬性组成部分；BDD 为 CRUD 子集可选回归，type-aware lint 为 advisory。本条为该门禁组成的 canonical 约束（bdd-test-harness r120/r_integration_tests 引用此处）。
