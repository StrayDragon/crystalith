# language: zh-CN
# capability: bdd-test-harness
# purpose: 定义 Crystalith v2 可选中文 BDD：Gherkin runner + bun test，覆盖已对齐的 CRUD 子集；LLM/插件域可 SKIP。BDD 不在 just qa 主门禁内。
# scope: apps/server/tests/bdd/

功能: bdd-test-harness

  @req:r24 @human
  场景: 中文 BDD 测试解析器
    - MUST 提供基于 @cucumber/gherkin 的 BDD runner，MUST 支持 language zh-CN 的 .feature 解析，MUST 与 bun test 集成（BDD 测试目录）。。

  @req:r82 @human
  场景: Feature 文件维护在 v2 树
    - MUST 在 BDD features 目录维护中文 .feature；API 路径 MUST 使用 /v2 前缀。活跃域与跳过白名单 MUST 在 BDD 运行器中明示。

  @req:r120 @human
  场景: BDD 为可选回归入口
    - MUST 提供 just test-bdd（或等价 BDD 运行命令）。MUST NOT 将 BDD 作为 just qa 或 pre-commit 硬性门禁，直至 skip 集合显著缩小。

  @req:r_integration_tests @human
  场景: Cross-module integration tests exist
    - 系统 MUST 在 server 集成测试目录提供关键路径覆盖；just qa MUST 包含该目录的 bun test。

  @req:r24 @human
  场景: s1
    - 必须成立：假如 Gherkin .feature 使用 zh-CN；当 运行 just test-bdd；那么 系统解析中文关键词并生成 test blocks
    假如 Gherkin .feature 使用 zh-CN
    当 运行 just test-bdd
    那么 系统解析中文关键词并生成 test blocks

  @req:r82 @human
  场景: s2
    - 必须成立：假如 features 目录存在多个域的 .feature；当 检查路径与 SKIP 集合；那么 活跃 CRUD 域使用 /v2；LLM/插件域在 SKIP 中不产生 fail
    假如 features 目录存在多个域的 .feature
    当 检查路径与 SKIP 集合
    那么 活跃 CRUD 域使用 /v2；LLM/插件域在 SKIP 中不产生 fail

  @req:r120 @human
  场景: s3
    - 必须成立：假如 开发者运行 just qa；当 观察是否执行 BDD；那么 SHALL 不自动运行 just test-bdd
    假如 开发者运行 just qa
    当 观察是否执行 BDD
    那么 SHALL 不自动运行 just test-bdd

  @req:r_integration_tests @human
  场景: qa_unit_dir
    - 必须成立：假如 开发者运行 just test；当 覆盖 apps/server/tests/；那么 SHALL 执行该目录下集成/单元用例
    假如 开发者运行 just test
    当 覆盖 apps/server/tests/
    那么 SHALL 执行该目录下集成/单元用例
