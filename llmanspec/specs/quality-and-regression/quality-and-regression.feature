# language: zh-CN
# capability: quality-and-regression
# purpose: 定义 v2 工程质量门槛：以 just qa 为主 PR 门禁，覆盖 typecheck/lint/format、配置漂移、server/shared 单测、web Rstest 与 Playwright @p0；BDD 与 type-aware lint 为可选。
# scope: apps/, packages/, e2e/, scripts/

功能: quality-and-regression

  @req:r213
  规则: Lint and format are part of the quality gate
    本地与 PR 主门禁 MUST 覆盖 typecheck 与 oxlint、oxfmt 检查（just check / just qa 的 check 段）。

    场景: lint-and-format-inside-just-check
      假如 检查 justfile 的 qa 与 check 配方
      当 运行 apps/server/tests/meta/gate-composition.test.ts 的 just qa/check 用例
      那么 qa 配方依赖 check 且 check 依赖 typecheck、lint、format-check
      而且 任一检查失败时主门禁以非 0 退出
  @req:r214
  规则: Frontend JS/TS lint uses Oxc entrypoints
    前端与仓库 JS/TS lint MUST 通过根 bun lint（oxlint）提供；apps/web MAY 另提供 lint / lint:all 增量与全量入口。

    场景: lint-entrypoint-is-root-oxlint
      假如 打开根 package.json 与 justfile 的 lint 配方
      当 运行 gate-composition.test.ts 的 lint 入口用例
      那么 根 scripts.lint 即 oxlint 且 just lint 委托 bun lint
      而且 apps/web 仍提供 lint / lint:all 增量与全量入口
  @req:r215
  规则: Formatting uses Oxfmt
    格式化检查 MUST 使用 oxfmt（bun format:check / just format-check），生成产物按工具配置排除。

    场景: format-check-uses-oxfmt
      假如 打开根 package.json 与 justfile 的 format-check 配方
      当 运行 gate-composition.test.ts 的 format-check 用例
      那么 format:check 即 oxfmt --check 且 just format-check 委托 bun format:check
      而且 format:write 提供 oxfmt --write 写入模式
  @req:r216
  规则: Backend and frontend verification are mandatory in primary gate
    主门禁 just qa MUST 执行 server+shared 单元/集成测试（just test）与前端 Rstest CI（just test-web / apps/web test:ci）。本条为 just qa 测试面组成的 canonical 约束。

    场景: qa-runs-test-and-test-web
      假如 检查 justfile 的 qa 配方与 apps/web 的 test:ci 脚本
      当 运行 gate-composition.test.ts 的 test/test-web 依赖用例
      那么 qa 配方同时依赖 test 与 test-web
      而且 test-web 调用 apps/web 的 Rstest CI（rstest run）
  @req:r217
  规则: Critical browser smoke exists
    仓库 MUST 维护 Playwright @p0 冒烟（just e2e），并纳入 just qa。

    场景: p0-smoke-gated-by-just-qa
      假如 检查 justfile 的 qa 与 e2e 目标
      当 just e2e 运行 e2e/tests/p0-smoke.spec.ts
      那么 @p0 workspace 冒烟用例（shell 挂载/API 健康等）被执行
      而且 just qa 的目标列表包含 e2e
  @req:r218
  规则: Config schema and env example drift checks are mandatory
    just qa MUST 运行 check-env-examples 与 check-app-schema（Zod SSOT → .env.example / secret.env.example / app.schema.gen.json）；任一检查发现与 Zod SSOT 不一致时，just qa SHALL 失败并以非 0 退出。

    场景: drift-checks-gated-by-just-qa
      假如 检查 justfile 的 qa、check-env-examples 与 check-app-schema 配方
      当 运行 gate-composition.test.ts 的 drift checks 用例
      那么 qa 配方依赖 check-env-examples 与 check-app-schema
      而且 两个配方都以 --check 运行，发现漂移即非 0 退出
  @req:r219
  规则: Local default unit entrypoints are scoped
    just test MUST 仅覆盖 apps/server/tests/ 与 packages/shared/test/（不自动运行 web Rstest 或 e2e）；完整 PR 验证 MUST 使用 just qa（含 web Rstest 与 e2e）。本条为本地默认测试入口范围的 canonical 约束。

    场景: just-test-scope-limited-to-server-and-shared
      假如 检查 justfile 的 test 配方
      当 运行 gate-composition.test.ts 的 just test 范围用例
      那么 配方执行 apps/server/tests/ 与 packages/shared/test/
      而且 不运行 web Rstest 也不运行 e2e
  @req:r220
  规则: Frontend test suites are tiered and reproducible
    前端稳定套件（test:ci）MUST 默认禁止未处理真实网络（MSW onUnhandledRequest=error，触发未被 MSW 覆盖的请求时测试 SHALL 失败），并运行 mock-reason 门禁（test-mock-report-check，稳定测试缺少 Mock reason 时 test:ci SHALL 失败）。核心子集 MAY 通过 test:core 单独运行。

    场景: test-ci-msw-and-mock-gates
      假如 打开 apps/web/package.json 与 justfile 的 test-web 配方
      当 运行 gate-composition.test.ts 的 frontend suites 用例
      那么 test:ci 在 RSTEST_MSW_ON_UNHANDLED=error 下运行，未处理请求导致失败
      而且 test:ci 先执行 test-mock-report-check，test:core 可单独运行核心子集
  @req:r221
  规则: Frontend test-double usage is observable
    仓库 MUST 提供前端 test doubles 报告入口（apps/web test-mock-report / test-mock-report-check，输出确定性统计），并在 test:ci 中执行 check。

    场景: mock-report-entrypoints-wired-into-test-ci
      假如 打开 apps/web/package.json 的 scripts
      当 运行 gate-composition.test.ts 的 test-double 用例
      那么 test-mock-report 与 test-mock-report-check（--check-mock-reasons）入口存在
      而且 test:ci 内嵌 test-mock-report-check 使报告可观测
  @req:r222
  规则: Remote CI status checks are optional
    仓库 MAY 提供 GitHub Actions 等远程 CI；在未提供 workflows 时，贡献者 MUST 以本地 just qa 作为 PR 自检门禁（PR 模板 SHALL 要求勾选本地 just qa），MUST NOT 假定 push/PR 上已有强制 CI 状态检查。
  @req:r223
  规则: BDD and type-aware lint are out of primary gate
    just test-bdd 与 just type-aware-lint MUST NOT 作为 just qa 的硬性组成部分；BDD 为 CRUD 子集可选回归，type-aware lint 为 advisory。本条为该门禁组成的 canonical 约束（bdd-test-harness r20/r_integration_tests 引用此处）。

    场景: bdd-and-type-aware-lint-out-of-just-qa
      假如 检查 justfile 的 qa 配方
      当 运行 gate-composition.test.ts 的 BDD/type-aware 排除用例
      那么 qa 配方不依赖 test-bdd 与 type-aware-lint
      而且 两者仍作为独立配方单独可用（bun test BDD / lint:type-aware）
