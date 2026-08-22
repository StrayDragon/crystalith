# Design — specs-compact-2026-08-b2

## D1 合并判定标准

两条 requirement 语义等价（同一 MUST 集合、同一验收面）才合并；「API 面 + UI 面」配对
（R17）不删除任一侧，仅把 UI 侧复述的服务端公式/状态语义改为对 runtime 的引用。

## D2 canonical 归属

| 组                           | canonical                                                                                     | 处置                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R1 camelCase wire            | openapi r132 + workspace-api-contract r285                                                    | fm r286/r287 保留前端特有断言，去与 wire 规则重复的句子                      |
| R4 notebook-scoped           | workspace-api-contract nested-path-nid-is-ownership-ssot + notebook-scoped-list-forbid-global | resource-access 与 nested-paths 两条并入前者语义后删除                       |
| R6 `/prompt:` 解析           | chat-prompt-presets preset-inline-directive                                                   | r25 并入；workspace-api-contract r69 改引用                                  |
| R7 stats preset              | chat-prompt-presets preset-stats                                                              | r192/r223 并入后删除                                                         |
| R9 tag/来源批量逐项结果      | management-and-tags r268                                                                      | sources-batch-per-item-results 并入；summary-and-conversion 的错位条目改引用 |
| R10 tag 唯一性               | management-and-tags tags-uniqueness-and-ownership                                             | r210 并入                                                                    |
| R11 from-url link 模式       | upload-and-url r269                                                                           | summary-and-conversion from-url-link-mode 改引用或删                         |
| R12 embedding 失败不置 ready | source-ingestion-core r2_sync                                                                 | conversion 条改引用                                                          |
| R14 epoch 失效               | retrieval-and-cache r174                                                                      | management-and-tags r106 重述部分改引用                                      |
| R15 深研入口唯一             | deep-research-ui r400                                                                         | workspace-ui-panels r59 后半句改引用                                         |
| R17 API↔UI 配对              | runtime r343/r334/r335/r344                                                                   | ui r461/r459/r460/r462 公式复述改引用                                        |

## D3 type-a 改写模式

函数名/文件名 → 行为名词（`writeBackNodeWork`→「写回节点工作」；`run.test.ts`→「BDD 运行器」）。
带「或等价」的 helper 名可保留。测试目录语义保留、实现文件名去除。

## D4 计数纪律

每次删除/合并同步更新 requirements[N]/scenarios[N] 计数；req_id 删除时确认无跨 spec 文本引用残留
（grep req_id 全 specs 目录）。

## 回滚边界

仅 `llmanspec/specs/**` 与 change 文档；revert 即完全回滚。
