# Design — c111-convert-pilot-bare-rules

## 场景合格标准（试点校准产物）

1. **结构化 GWT**：`场景:` 嵌套在 `规则:` 块内，假如/当/那么 三段，步骤为可重复执行的判定动作或检查动作；步骤文本不写 MUST/SHALL（那是规则描述的职责）。
2. **house style**：对齐 web-ui-foundation r341（`p0-anchors-survive-component-replacement`）与 r342（`source-and-deps-do-not-reference-material-tailwind`）的既有场景——静态可判定行为用「当 扫描/检查 X，那么 Y」形态，不追求绑定 runner 步骤代码。
3. **锚点**：每个新场景在下方映射表注明既有测试资产（测试文件/套件）或判定方式；无任何可重复判定方式的条款不硬写场景。
4. **本批次不启用 `llmanspec/config.yaml` 的 `bdd:` 段**：场景为结构校验级；feature-as-spec 执行接线（把 specs 场景接入 runner）是独立后续批次。

## 逐条判定（14 条裸规则）

| @req | capability                 | 判定                     | 处置                                                                                                                              |
| ---- | -------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| r18  | bdd-test-harness           | A（本 change 实现）      | 补场景：runner 执行 `规则:` 块内嵌套场景（fixture feature 验证）                                                                  |
| r19  | bdd-test-harness           | A（静态结构）            | 补场景：features 树用 /v2 路径 + SKIP 白名单在 run.test.ts 明示                                                                   |
| r20  | bdd-test-harness           | A（锚 just test-bdd）    | 补场景：`just test-bdd` 可选回归入口可运行                                                                                        |
| r21  | bdd-test-harness           | A（锚 just test）        | 补场景：server 集成覆盖存在且入 just test/qa 门禁                                                                                 |
| r28  | chat-ui-envelope           | A（静态扫描，r342 同型） | 补场景：运行时零 `[[crystalith-ui:v1]]` delimiter                                                                                 |
| r29  | chat-ui-envelope           | A（静态扫描，r342 同型） | 补场景：前端零 envelope marker 解析                                                                                               |
| r338 | web-ui-foundation          | A（静态结构）            | 补场景：展示件集中于 shared UI 层                                                                                                 |
| r339 | web-ui-foundation          | A（静态结构）            | 补场景：弹层走 headless + Layer，无硬编码 z-index                                                                                 |
| r340 | web-ui-foundation          | A（静态结构）            | 补场景：对话框复用统一 overlay 策略                                                                                               |
| r343 | web-ui-foundation          | **C（保留裸规则）**      | 视觉 token 一致性属人工评审判断，无程序判定口径；理由：强写 GWT 会失真（设计系统对齐由 DESIGN.md 与评审流程承载）                 |
| r383 | workspace-command-registry | A（锚 Zod schema）       | 补场景：命令对象 kind 字符串枚举、meta（若有）为 JSON object，未知 kind 客户端 MAY 忽略                                           |
| r236 | slides-workflow-plugins    | A（静态契约面）          | 补场景：slides workflow plugin 契约面完整（metadata/configSchema/generate_outline/generate_markdown/可选 preview/frontendBundle） |
| r237 | slides-workflow-plugins    | A（可单测的选择逻辑）    | 补场景：single-active 选择确定性（default_plugin 优先；0/多候选返回结构化诊断）                                                   |
| r238 | slides-workflow-plugins    | A（仓库事实）            | 补场景：官方 reference plugin（slides-slidev）存在并可经 active plugin 暴露 SLIDES tool                                           |

## runner `规则:` 下钻语义

- 场景收集：`feature.children` 的顶层 `scenario` 与 `rule.children` 内的 `scenario` 一并注册；rule 内场景执行前先跑 feature 级 background，再跑 rule 级 background（若存在）。
- 标签继承：rule 标签并入该块内场景的 skip 判定（`@skip` / `@experimental` 与 `options.skipScenarios` 语义不变）。
- 兼容性：无 `规则:` 块的 feature 行为不变（现有 28 个 BDD 用例为回归基线）。

## 锚点映射

| 场景                | 锚点                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| r18 场景            | 新增 `apps/server/tests/bdd/features/harness/*.feature`（规则块 fixture）+ `just test-bdd`                                                         |
| r19/r20/r21 场景    | `apps/server/tests/bdd/run.test.ts`（SKIP_FEATURE_DIRS）、justfile `test-bdd`、`apps/server/tests/`（setupIntegrationEnv 集成面，入 just test/qa） |
| r28/r29 场景        | 静态源码扫描（r342 同型；当前零命中即合规）                                                                                                        |
| r338/r339/r340 场景 | `apps/web/src/shared/ui`（Layer 系统所在）静态结构                                                                                                 |
| r383 场景           | 命令对象 wire schema（shared Zod；`/v2/commands` 合约）                                                                                            |
| r236/r237/r238 场景 | `packages/crystalith-slidev/`、`apps/server/src/plugins/builtin/`（slides-slidev reference plugin）                                                |
