# language: zh-CN
# capability: bdd-test-harness
# purpose: 定义 Crystalith v2 可选中文 BDD：Gherkin runner + bun test，覆盖已对齐的 CRUD 子集；LLM/插件域可 SKIP。BDD 不在 just qa 主门禁内。
# scope: apps/server/tests/bdd/

功能: bdd-test-harness

  @req:r24 @human
  场景: 中文 BDD 测试解析器
    - MUST 提供基于 @cucumber/gherkin 的 BDD runner，MUST 支持 language zh-CN 的 .feature 解析，MUST 与 bun test 集成（BDD 测试目录）。

  @req:r82 @human
  场景: Feature 文件维护在 v2 树
    - MUST 在 BDD features 目录维护中文 .feature；API 路径 MUST 使用 /v2 前缀。活跃域与跳过白名单 MUST 在 BDD 运行器中明示。

  @req:r120 @human
  场景: BDD 为可选回归入口
    - MUST 提供 just test-bdd（或等价 BDD 运行命令），作为已对齐 CRUD 子集的可选回归入口；在 skip 集合显著缩小前，BDD 不进入 just qa / pre-commit 硬性门禁——门禁组成的 canonical 归属见 quality-and-regression r_bdd_optional。

  @req:r_integration_tests @human
  场景: Cross-module integration tests exist
    - 系统 MUST 在 server 集成测试目录提供关键路径集成覆盖；该目录进入 just test 与 just qa 门禁的归属见 quality-and-regression r99/r172（canonical）。
