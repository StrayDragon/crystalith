# Design — 移除无代码对应 spec 块

## 分析方法（可复用于后续 D 组决策）

对候选块逐条做「代码对应三查」：① 实现符号 grep（capability 主题词在 server/shared/web 的命中）；② 语义甄别（命中是否同概念：文案 ≠ 实现，异 capability 同名机制 ≠ 本块）；③ 覆盖判定（已实现者是否已有合约条款/测试覆盖 → 冗余合并 or 迁移补测）。处置三态：**移除**（零实现且无近期计划）、**迁移**（已实现但误挂 vision 块）、**保留**（有实现或有明确实现排期）。

## 逐条处置与证据

### source-aware-generation-modes（7/7 移除，整 capability 删除）

| req                      | 规则                                                                                                               | 证据                                                                                                              | 处置                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| r239/r240/r242/r243/r419 | 生成类型声明 source_mode / 影响 citation / 请求结果回传模式 / 影响检索 / strict_evidence 与 brainstorming 行为差异 | `sourceMode\|usageMode\|source_mode` 在 `apps/server/src`、`packages/shared/src` 零命中；`strict_evidence` 零命中 | 移除                   |
| r241                     | 来源模式不得反向重写上游对象模型                                                                                   | 依赖不存在的 source_mode 概念                                                                                     | 移除（C 豁免随之注销） |
| r244                     | 模式标签不暴露内部术语                                                                                             | 同上；且无任何模式 UI                                                                                             | 移除（C 豁免随之注销） |

甄别记录：`apps/server/src/features/qa/presets.ts:62` 的 "brainstorming techniques" 是「发散联想」预设的提示词文案，非模式实现；sources 的 normal/deep 处理模式（`tests/sources/mode-normalization.test.ts`）是**来源处理模式**，归属摄取域规则，与本 capability 的**生成来源使用模式**不同概念。

### cross-type-result-transformations（6 移除 + 1 迁移，整 capability 删除）

| req     | 规则                                                                | 证据                                                                                                                                                                                                        | 处置                                                                                   |
| ------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| r39-r43 | 转换能力清单 / lineage / 回退重生成 / 显式转换动作 / 元数据映射摘要 | `lineage\|transformation` 在 `apps/server/src`、`packages/shared/src` 零命中；`tests/sources/c117-conversion-lineage.test.ts` 覆盖的是 output→source 转换（r276-r281，另一 capability）                     | 移除                                                                                   |
| r44     | GET single session                                                  | 已实现：`apps/server/src/features/sessions/router.ts:153`（c39 v1 parity）；已被 `workspace-api-contract` r349「Notebook/session/message endpoints are stable」（带场景）覆盖                               | 移除（冗余合并）                                                                       |
| r45     | convert-to-output 收集 citations chunkIds                           | 已实现：`apps/server/src/features/sessions/convert.ts:48-59`（`citationChunkIds` 去重收集）+ `:221`（挂到创建的 output）；但 `apps/server/tests/api-contract/qa-session-contract.test.ts` 无 chunk_ids 断言 | **迁移**至 workspace-api-contract（r365/r366 convert 合约群旁），补嵌套场景 + 集成断言 |

## 方案权衡

- 「保留并改写为 DEFERRED 豁免」（c120 报告原建议 ①）：被用户原则否决——spec 应与代码对应，无实现且无排期的愿景不入合约。
- 「保留 r39-r43 等实现时再落」：无排期诉求，挂账成本（pending 信号、误导排序）大于收益。
- r45 保留原 `@req:r45` 句柄跨文件迁移：句柄全局唯一，历史档案引用（如有）保持可解析。

## 测试边界（seam）

复用既有 `qa-session-contract.test.ts` 集成 seam（setupIntegrationEnv + Eden HTTP），不新增 harness：在既有 convert-to-output 用例上补 citations→chunk_ids 断言（构造含 chunkId 的 citation 的 assistant 消息 → 调 convert-to-output → 断言 output 附带去重 chunkIds）。spec 场景文案与该断言同形（A 类锚定）。
