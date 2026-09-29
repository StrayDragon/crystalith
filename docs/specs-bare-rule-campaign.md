# Specs 裸规则压降作战地图（llman-sdd 0.5 pending 计量）

> 状态：**缺口处置第一批完成（2026-09-28）；剩余 108 条已八组深挖定性（2026-09-29，见「分组深挖」节）**。pending **448 → 108**：c111 试点（13）→ c112 碰撞修复 → c113 非深研 A 类（118）→ c114 深研双雄 A 类（121）→ c115 API 合约（16）→ c116 门禁/服务侧（26）→ c117 摄取/抽取/深研运行时（23）→ c118 前端组件区（18）→ c119 顺延低难度（15）→ c120 缺口处置一（3：r290 修复 + r111/r351 合约对齐）。c121 清理（94）后，**c122 整层实现 typed-generation-framework（2026-09-29）**：生成类型一等公民落地（qa/output/slides 注册表 + GET /v2/generation-types + qa/outputs 强制 generationTypeId + controls/effective 回传 + presets 白名单消费修复 r23/r25 违约 + r422/r24 实现 + r166/r423 合约改写 + r50 移除 + C 升格 3）。**c126 B 组收口（2026-09-29）——战役完成**：剩余 **41 条全部为有据豁免（C 台账）**，可行动批次债清零。c126 处置：r101/r416 照做（条件轮询 + 面板错误快照，场景化锁测）；r405/r411/r413/r417 移除（tool 卡与 r350 架构冲突 / 三 tab 无排期蓝图 / 状态派生需 server 消息状态字段 / 假条目与来源=服务端实体不符）。本档达成删除条件——转为纯记录态，后续仅在 capability 增删或 specs-compact 时更新。同批完成：retired-req-ids 护栏脚本（llman-sdd#5 上游修复前兜底，入 `just check` 门）与幻影锚点审计（r13/r205 两处真幻影重锚到真实测试）。原则：spec MUST 应有代码对应——无实现且无排期者移除（E 组），实现则场景化自动守护（D 组）。
> **状态：已达成删除条件（2026-09-29，c126 收口）——本档为纯记录态。**仅当出现新裸规则（新 capability/新条款）、capability 增删或 specs-compact 收敛时更新或删除本档。

## specs-compact 执行记录（2026-09-29，llman-sdd 0.7.0）

- **合并冗余**：全量检测 0 组重复步骤序列的场景；跨 capability 重复 req id 为 0（`project dedupe-req-ids --dry-run`）。语义核查三个候选均非等价冗余：r180 携带独立「重试不堆叠」约束（r15/r183/r184 未覆盖）；r190/r191 为正/反两面分工（正向义务 vs 禁令面，已互相引用）；r78/r79 为不同治理面（合约对齐 vs extras 文档化）。**无可合并项，41 条豁免各自独立承载语义**。
- **归档 freeze**：`archive freeze --before 2026-09-28 --keep-recent 6` 冻结 19 个旧归档为 `freezed_changes.7z.archived`，archive 1.1M → 876K。
- 同批完成 llman-sdd 0.5.1 → **0.7.0** 升级（next-req-id 改 max+1 修复 issue #5，护栏脚本随之退役；子项目多根为可选能力，本项目单根未采用）。

## 背景

llman-sdd 0.5 原生分层格式下，规则（`规则:` 块 + `@req` 句柄）的首选形态是带嵌套 `场景:`（可执行 GWT）；无嵌套场景的**裸规则**合法但需记录理由，并以 review `pending` 信号计量，交 specs-compact / 补场景压降。0.4→0.5 迁移后全仓 **461 条裸规则 / 35 capability**。

## P0 前置：req_id 碰撞修复 ✅ 已完成（c112，merge 17d4cf08）

历史「重排全局 req id」遗漏导致同一文件内多个规则头共用同一 `@req` 编号。句柄系统（resolve-req / review 报告 / 锁定报告 / 归档引用）依赖全局唯一，**补场景锚定 @req 前必须先修复**。

- 规模：**45 个碰撞 tag / 54 处需重取号 / 11 个文件**（重灾区 deep-research-ui 18、deep-research-runtime 14）。
- 详细清单（tag → 行号 → 规则标题）：见本文末尾附录。
- **上游工具缺口**（llman-sdd 0.5.0，两处均未报出）：
  1. `validate` 的「全局重复 req_id」ERROR 门未检测同文件内碰撞（如 deep-research-ui L8/L176 同挂 r99，validate 判 valid）；
  2. `project dedupe-req-ids --dry-run` 报 "No colliding req_id values"（疑似只查跨文件）。
- 处置：c112 已按 `spec next-req-id` 重取号（首现保留原号，后续 → r420-r473）。上游两处漏报已报 [llman-sdd#4](https://github.com/StrayDragon/llman-sdd/issues/4) 并于 **0.5.1 修复**（detect-same-file-req-dupes；同文件碰撞注入实测 validate ERROR + dedupe remap 计划均拦截），本地 `just check-req-ids` 兜底脚本已退役。

## 分类口径（c111 design 校准产物）

- **A** 可补嵌套场景·映射既有测试：行为可程序判定，且现有测试资产已覆盖或极贴近（锚点到测试文件/套件）。
- **B** 需新增测试资产：可程序判定但明显未覆盖，补场景需同时补测试。
- **C** 合法裸规则：架构决策/治理约束/愿景叙述，无法（完全）程序判定，保留裸规则并在 change 文档记录理由。

## 试点批次（c111-convert-pilot-bare-rules，已收口）

- 范围：最小 5 capability，14 条裸规则 → 补 **13 个嵌套场景**（结构化 GWT，house style 对齐 r341/r342 范式）+ **1 条有据豁免**（web-ui-foundation r343，视觉 token 一致性属人工评审）。
- 配套：`apps/server/tests/bdd/runner.ts` 支持 `规则:` 块下钻（嵌套场景执行、rule 标签继承、rule 级 background）+ harness fixture；`llmanspec/config.yaml` 启用 `bdd.run_command`（用户确认）。
- 证据：validate --specs --strict 35/35；`just test-bdd` 30/30（+2 规则块用例）；`just qa` 全绿；review pending 461 → **448**；顺手修复 source-aware-generation-modes 的 r243 重号（→r419）。

## 全量盘点（35 capability / 461 条裸规则；试点后余 448 条）

> 全量已分类：**A 242 / B 159 / C 47**（pilot 13 条压降 + 1 条有据豁免已计入对应 capability 行）。逐条 tag/标题/锚点明细由盘点分片报告产出，各批次 change 设计时按行复验后落入该批 design.md。

| #   | capability                              | pending(裸规则) | A   | B   | C   | 备注                                                                                                                              |
| --- | --------------------------------------- | --------------- | --- | --- | --- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | studio-output-types                     | 8               | 2   | 6   | 0   | r299-r303 前端 viewer 全无测试（B 集中区）                                                                                        |
| 2   | source-ingestion-management-and-tags    | 8               | 5   | 3   | 0   |                                                                                                                                   |
| 3   | source-connectors                       | 8               | 6   | 2   | 0   | bdd features 已有步骤基础                                                                                                         |
| 4   | source-aware-generation-modes           | 0（c121 移除）  | —   | —   | —   | c121 整块移除（零实现愿景，7 条含 C 豁免 2）                                                                                      |
| 5   | openapi-and-client-generation           | 7               | 4   | 0   | 3   | parity/asyncapi 测试可直接锚定                                                                                                    |
| 6   | data-and-storage                        | 7               | 2   | 2   | 3   | r46-r48 选型决策合法裸规则                                                                                                        |
| 7   | cross-type-result-transformations       | 0（c121 移除）  | —   | —   | —   | c121 整块移除（零实现）；r44 冗余并入 r349、r45 迁 workspace-api-contract                                                         |
| 8   | generation-presets-and-constraints      | 5               | 1   | 3   | 1   |                                                                                                                                   |
| 9   | deep-research-ui                        | 76              | 65  | 9   | 2   | 研究锚点：research-lab/*.test + p0-eden-lab.spec；**18 个碰撞 tag 已修（c112）**                                                  |
| 10  | deep-research-runtime                   | 63              | 56  | 3   | 4   | 锚点：apps/server/tests/research/*（runtime/budget/prune/synthesize-retry 等）；**14 个碰撞 tag 已修（c112）**（含 r69×4、r83×3） |
| 11  | generation-core                         | 16              | 9   | 5   | 2   | 锚点：apps/server/tests/{outputs,qa}/*                                                                                            |
| 12  | workspace-ui-core                       | 15              | 8   | 5   | 2   | 锚点：e2e p0 + useWorkspaceReadiness 等；**3 个碰撞 tag 已修（c112）**（r388/r389/r394）                                          |
| 13  | studio-slides-workflow                  | 15              | 11  | 4   | 0   | 锚点：apps/server/tests/studio/* + BDD 工作室场景                                                                                 |
| 14  | slides-workflow-plugins                 | 0               | —   | —   | —   | c111 已压降                                                                                                                       |
| 15  | chat-ui-envelope                        | 0               | —   | —   | —   | c111 已压降                                                                                                                       |
| 16  | web-ui-foundation                       | 1               | —   | 0   | 1   | c111 后仅剩 r343（有据豁免）                                                                                                      |
| 17  | workspace-command-registry              | 0               | —   | —   | —   | c111 已压降                                                                                                                       |
| 18  | bdd-test-harness                        | 0               | —   | —   | —   | c111 已压降                                                                                                                       |
| 19  | frontend-eden-migration                 | 5               | 3   | 1   | 1   | r158 负向禁令缺锁测（仿 r29 静态扫描）                                                                                            |
| 20  | public-repo-hygiene                     | 5               | 0   | 3   | 2   | r209/r211 治理项豁免候选                                                                                                          |
| 21  | workspace-api-contract                  | 35              | 17  | 18  | 0   | 锚点：errors/schemas/notebook-isolation/BDD 知识问答；**r373×2 碰撞已修（c112）**；B 集中（convert/export/models 断言缺）         |
| 22  | workspace-ui-panels                     | 21              | 4   | 17  | 0   | 前端组件级测试基建缺失，B 最大区                                                                                                  |
| 23  | source-ingestion-upload-and-url         | 16              | 5   | 10  | 1   | 锚点：ingest/url-safety/sources-search；**r287×3 碰撞已修（c112）**（markdown 预处理三条款）                                      |
| 24  | retrieval-and-cache                     | 13              | 7   | 6   | 0   | 锚点：rag/{cache,chunker,multi-query,context-window}；**r234×2 碰撞已修（c112）**                                                 |
| 25  | source-ingestion-summary-and-conversion | 12              | 5   | 7   | 0   | 锚点：summary-cache/qa-to-source-and-tags                                                                                         |
| 26  | output-rendering-and-typing             | 12              | 8   | 3   | 1   | 锚点：GenericOutputRenderer/collect-cited-citations/BDD 结构化输出；r201×2 碰撞待 c112                                            |
| 27  | typed-generation-framework              | 11              | 1   | 5   | 5   | 整块偏框架决策；r322/r324 碰撞待 c112                                                                                             |
| 28  | quality-and-regression                  | 11              | 1   | 9   | 1   | r213-r223 多数可由 justfile 断言程序化（B）                                                                                       |
| 29  | architecture-core                       | 10              | 3   | 1   | 6   | r1-r6 结构约束合法裸规则；r7×3 碰撞待 c112（proxy 三条为 A）                                                                      |
| 30  | web-extractor-plugins                   | 9               | 4   | 5   | 0   | 锚点：plugins/registry + c62 shape；r332×3 碰撞待 c112                                                                            |
| 31  | source-ingestion-core                   | 9               | 5   | 4   | 0   | 锚点：ingest/rag cache/embed-timing/csv-parser                                                                                    |
| 32  | generation-observability-and-guardrails | 9               | 1   | 7   | 1   | 可观测字段类多缺测试（B）                                                                                                         |
| 33  | configuration-governance                | 9               | 2   | 3   | 4   | r31/r33/r35/r36 命名与治理豁免候选                                                                                                |
| 34  | chat-prompt-presets                     | 9               | 4   | 5   | 0   | 锚点：qa/presets + BDD 知识问答；r22×3/r27×2 碰撞待 c112                                                                          |
| 35  | architecture-plugin-and-agent           | 9               | 3   | 1   | 5   | 技术选型/延期声明（C）；r13/r14/r17 可锚定                                                                                        |

> **全量盘点完成**：35 capability / 448 条 pending 全部分类 —— **A 242（54%）/ B 159（36%）/ C 47（10%）**，与 review 计数精确吻合。分片报告的逐条规则表（tag/标题/类别/锚点）在各批次 change 的 design 中按需复验落档。

## 批次规划

## 批次推进

| 批次                                   | 状态               | 结果                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~c111 试点~~ ✅                       | merge 96345d55     | 5 capability 13 场景 + runner 规则块下钻 + bdd.run_command                                                                                                                                                                                                                                                                                                                                                                                         |
| ~~c112（P0 碰撞）~~ ✅                 | merge 17d4cf08     | 54 处重号 r420-r473 + `just check-req-ids` 自检；上游漏报已报 [llman-sdd#4](https://github.com/StrayDragon/llman-sdd/issues/4) 并于 0.5.1 修复（detect-same-file-req-dupes，双门实测拦截）→ 本地 `check-req-ids` 脚本已退役                                                                                                                                                                                                                        |
| ~~c113 非深研 A 类~~ ✅                | merge f99e81ab     | 118 场景                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ~~c114 深研双雄 A 类~~ ✅              | merge 6cd6c2fa     | 121 场景                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ~~c115 API 合约 B 区~~ ✅              | merge bd01ed1e     | 16 覆盖 + 28 集成测试；缺口 r345（鉴权未实现）/r351（UI state 端点不存在，牵动 chat-ui-envelope r29 合约）                                                                                                                                                                                                                                                                                                                                         |
| ~~c116 门禁/服务侧~~ ✅                | merge 1669e7ac     | 26 覆盖（门禁组成锁测 9 全中）；缺口 r422/r423/r24/r166                                                                                                                                                                                                                                                                                                                                                                                            |
| ~~c117 摄取/抽取/深研运行时~~ ✅       | merge 692a3bc3     | 23 覆盖；缺口 r287/r464/r465（markdown 预处理未实现）/r290（空文件上传 200/ready/0-chunk 缺陷）/r295/r469 半边（415 路径不存在）/r334 合取未算                                                                                                                                                                                                                                                                                                     |
| ~~c118 前端组件区~~ ✅                 | merge 51cbfd87     | 18 覆盖（panels 12 + ui-core 5 + r158 负向扫描）；web 测试 339→371；缺口 r405/r411/r413/r416/r417（前端无对应实现）                                                                                                                                                                                                                                                                                                                                |
| ~~c119 顺延低难度批~~ ✅               | merge 7534d6f2     | 15 覆盖（web 17 例 + server 28 例）；**r111 坐实违约保持裸规则**：ResearchLabPage 被动读 URL ?rid= 恢复 Run（useEdenLabController 无条件 loadRun），不经显式动作/无会话门控；r462 apiVersion 复核为已实现非缺口                                                                                                                                                                                                                                    |
| ~~c120 缺口处置一~~ ✅                 | merge a8f67173     | **r290 产品修复**（空文件前置 400；零分块回滚行+storage 并 400；catch 对 AppHttpError 重抛）；r111 合约改写（rid=应用内导航载体，非外部 deep link 保证）；r351 合约改写（UI 状态由 session 资源承载，无 /ui/* 端点）+ r29 勘误；顺带记录 parser 误选 html 线索归 r257                                                                                                                                                                              |
| ~~c121 无对应代码块清理~~ ✅           | merge 956ce84b     | 移除零实现两 capability（cross-type 7 + source-aware 7）；r44 冗余移除（r349 已覆盖）、r45 迁 workspace-api-contract 补场景+chunk_ids 断言；pending 108 → 94；确立「spec 无代码对应 → 实现 or 移除」原则                                                                                                                                                                                                                                           |
| ~~c122 typed-generation-framework~~ ✅ | merge 7de5e8d1     | 整层实现：注册表+GET /v2/generation-types、qa/outputs 强制 generationTypeId（缺失/错配 400）、controls 注入与 effective 回传、outputs 默认 PARAGRAPH + generation_meta 落库、presets 白名单消费（修复 r23 静默回退 / r25 无检查两项既有违约）、r422/r24 实现、r166/r423 改写、r22 措辞、r50 移除、C 升格 r323/r325/r327；pending 94 → 79；server 611 / web 388 / bdd 30 / e2e 31 全绿                                                              |
| ~~c123 摄取真缺陷修复~~ ✅             | merge bb2c3793     | **r257 根因修复**（复现修正 c120 线索：application/* 前缀误配 pdf + parserType 覆盖失效；去前缀匹配/去 text 默认回退，显式覆盖走 getParser）；r258/r295 落地 415 UNSUPPORTED_MEDIA_TYPE + details{mimeType,filename,pluginHint}；r287/r464/r465 markdown 预处理（wikilink 归一/嵌入→图片或文本引用/frontmatter→source.metadata 并剥离，零扰动保证）；r52 改写为字节持久化合约（v2 无任务队列）；pending 79 → 72；server 620 / bdd 30 / e2e 31 全绿 |
| ~~c124 顺延可测批~~ ✅                 | merge 35fcf132     | A 组 13 条全部场景化（server 锁测 r250/r252/r254/r310/r316/r317；web 锁测 r302/r303/r102/r148/r445/r446/r313）；r303 计分预警解除（实测无 bug）；r102 合约改写为 overlay-drawer 语义；r13/r205 幻影锚点重锚 + 补 SLIDES 专属 400 断言；retired-req-ids 护栏脚本入库；pending 72 → 59；server 630 / web 405 / bdd 30 / e2e 31 全绿                                                                                                                  |
| ~~c125 C/H 移除 + G 场景化~~ ✅        | merge fe31f300     | C5（r176-r179/r182 观测条款零实现）与 r345（鉴权零实现，含 app.auth/CRYSTALITH_API_KEY 死字段清理）移除；G6（r30/r32/r34/r37/r38/r16）场景化锁测（config-governance 14 用例 + registry r16 断言；resolveMigrationsFolder 转导出）；pending 59 → 47；server 658 / bdd 30 / e2e 31 全绿                                                                                                                                                              |
| ~~c126 B 组收口~~ ✅                   | merge 150b923a     | r101 照做（researchQueuePollInterval 条件轮询 5s/0 + SWR 数据依赖接入）、r416 照做（面板头部失败摘要条）、r405/r411/r413/r417 移除（架构冲突/无排期/双层 spec-ahead/假条目）；pending 47 → 41（全豁免）；**战役完成，可行动批次债清零**；web 409 / bdd 30 / e2e 31 全绿                                                                                                                                                                            |
| **顺延（未开批）**                     | 待下一会话         | deep-research-ui 交互 9（r101/r102/r111/r117/r148 等）、studio-output-types 6（r299-r303/r306，r306 为 server FK 可先做）、generation-observability 7（r176-r179/r182-r184）、retrieval/其余散量                                                                                                                                                                                                                                                   |
| **spec 领先实现**                      | 转入待实现         | cross-type 7、source-aware 5——实现落地后按 A 类流程补场景                                                                                                                                                                                                                                                                                                                                                                                          |
| 持续                                   | C 类 47 条豁免台账 | 见下节；specs-compact 时机再评估合并                                                                                                                                                                                                                                                                                                                                                                                                               |

## 顺延可测项调研（2026-09-28，agent 全量核查：20 可测 / 10 缺口）

| 批次                                          | 内容                                                                                                                                                                                                                                                                                                                          | 形态与预警                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **c119（下一批，低难度同批 ~15 条）**         | r117 画布偏好零请求、r442 sources 无深研残留（静态扫描）、r447 compose 后 badge、r111 无 run URL deep link、r299/r300/r301 viewer 交互、r306 outputId FK、r183/r184 Retry-After 与 timeout（ai/middleware 一套）、r261 web 搜索不冒充、r202 OutputRead 全字段、r197 discriminated union、r330 quality 修补循环、r322 注册发现 | 全部有真实实现，仿既有范式；**r111 预警：ResearchLabPage 存在被动 URL 恢复 runId，可能违约，实测判定** |
| c120 studio 重交互批                          | r302 Mindmap / r303 Quiz（Quiz 可能测出计分 bug）                                                                                                                                                                                                                                                                             | web Rstest                                                                                             |
| c121 deep-research-ui 重交互批                | r102 详情层保挂载 / r445 conclusion 防剪枝展示 / r148 失败无启发式报告                                                                                                                                                                                                                                                        | web Rstest，可能测出真 bug                                                                             |
| c122 可观测性落地批（先实现后测，走 propose） | r176 traceId / r177 耗时字段 / r178 errorKind / r179 cache hit-miss / r182 优雅停机——server 无对应实现                                                                                                                                                                                                                        | 实现+测试                                                                                              |
| 缺口处置批（需产品决策：实现 or 修合约）      | r101 轮询子句、r50 inferSelect 导出、r52 document_parse、r258 不支持格式拒绝（现静默回退 text，**测则必出违约**）、r462 apiVersion 分支、r467 defaultOutputType、r466 概览字段 + 各批已记产品缺口                                                                                                                             | 逐条决策                                                                                               |

## 分组深挖：剩余 62 条可行动（2026-09-29，代码现状经 grep 核验）

| 组                             | 条数 | 成员（req）                                                             | 代码现状核验                                                                                                                                                      | 处置形态与预警                                                                           |
| ------------------------------ | ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ~~A 顺延可测批~~ ✅            | 0    | （原 r316/r317/r250/r252/r254/r102/r148/r445/r446/r302/r303/r310/r313） | 逐条核验：r317/r250/r252/r310 均已有实现（c51/c44 等）；r303 计分逻辑实测无 bug；r102 现实为 overlay 抽屉（非 modal）——合约对齐实现                               | **c124 已收口**：13 条场景化自动守护                                                     |
| ~~B 前端功能缺口~~ ✅          | 0    | （原 r405/r411/r413/r416/r417/r101）                                    | 逐条拍板完成：r101/r416 部分实现 → 小实现照做；r405/r413 与纯文本架构/双层 spec-ahead 冲突、r411 无排期蓝图、r417 与来源实体模型不符 → 移除                       | **c126 已收口**：B 组清零，战役完成                                                      |
| ~~C 可观测性落地~~ ✅（移除）  | 0    | （原 r176-r179/r182）                                                   | traceId/耗时/errorKind 字段与 cache 日志在生成链路零命中（studio c51 属 slides 专属）；r182 前提「任务队列 worker」v2 不存在                                      | **c125 已移除**：观测能力列入路线时先实现再立 capability                                 |
| ~~D 类型化生成+预设合约面~~ ✅ | 0    | （原 r466/r467/r324/r326/r166/r186-r189/r422/r423/r24/r50）             | c122 核查升级：presets CRUD（c61）早已存在但生成链路不消费——r23 静默回退 / r25 无检查属**幻影覆盖**（场景挂在 SKIP 的 BDD qa 域）                                 | **c122 已整层实现**：12 条全部场景化自动守护（r50 移除、r166/r423 改写）                 |
| ~~E spec 领先两整块~~ ✅       | 0    | （原 r39-r45；r239 r240 r242 r243 r419）                                | cross-type transform/lineage 与 server sourceMode 均 grep 零命中；r44 为 r349 冗余、r45 已实现（convert.ts citationChunkIds）但无断言                             | **c121 已收口**：12 条移除 + r45 迁移补场景补测；原则：无代码对应 → 实现 or 移除，不挂账 |
| ~~F 摄取解析真缺陷~~ ✅        | 0    | （原 r257/r258/r295/r287/r464/r465/r52）                                | 复现修正：真根因是 application/* 前缀匹配误配 pdf + parserType 覆盖失效（.txt/.md 今日本就命中 text）；r258 静默回退违约坐实；v2 无任务队列（r52 为 v1 词汇残留） | **c123 已收口**：415 拒绝语义 + markdown 预处理 + r52 改写字节持久化合约                 |
| ~~G 配置治理可程序化~~ ✅      | 0    | （原 r30/r32/r34/r37/r38/r16）                                          | 全部有实现（config-env 优先级链/三段流水线/getDataRoot/确定性/分发三级解析/CrystalithPlugin registry）                                                            | **c125 已收口**：6 条场景化锁测（config-governance 14 用例 + registry r16）              |
| ~~H 鉴权~~ ✅（移除）          | 0    | （原 r345）                                                             | auth.enabled 死配置零消费，server.ts "v2 has no auth yet"；无排期                                                                                                 | **c125 已移除**：鉴权立项时先实现再立 capability（含健康探活匿名语义）                   |

> 建议批次序：**c121 = F（真 bug）或 A（顺延可测）→ c122 = 另一者 → c123 = C → c124 = G(+H)**；B/D/E 需产品决策，其中 E 合约化一次压降 12 条。

## req id 退役护栏（已退役，2026-09-29）

上游 llman-sdd **0.7.0 已将 `spec next-req-id` 改为 max+1 语义**（修复 issue #5，有意不提供旧行为开关；见迁移指引 migrations/v0.6-v0.7）。本项目护栏脚本 `check-retired-req-ids` 与 `just check` 挂钩按其自述条款随之退役（r39-r45/r50/r239-244/r419 不会再被取号发出）。

## 附录：req_id 碰撞清单（45 个 tag）

> 碰撞清单已于 c112 全量修复（54 处重号，首现保留、后续 r420-r473），附录按文档纪律删除。防回归现由上游 0.5.1 全局门承担（validate ERROR + dedupe-req-ids）。

## C 类豁免台账（40 条，保留裸规则的记录）

> 判据：架构决策 / 治理约束 / 选型声明 / 愿景叙述，无法（完全）程序判定，强写 GWT 会失真。后续若有条款获得可程序判定口径（如新增静态检查），随时升格补场景。

### 选型与架构决策（24 条）

- architecture-core r1-r6：feature 切片 / 依赖方向 / 路由聚合 / 前端 domain 切片 / app-shared 薄边界 / Zustand 分片（结构约束）
- architecture-plugin-and-agent r9/r10/r12：AI SDK v7 / 官方 @ai-sdk/* providers / generateObject+Zod（技术选型）；r16 已随 c125 升格为场景（单点 registry 有程序判定口径）
- architecture-plugin-and-agent r11：agent loop DEFERRED（延期声明）；r15：middleware 职责叙述
- data-and-storage r46/r47/r48：单 SQLite 文件 / Drizzle ORM / Drizzle Kit（选型与流程约束）
- deep-research-runtime r53：ResearchRun process SSOT；r56：共享 webSearch tool only（架构决策）
- openapi-and-client-generation r190/r191/r192：Eden 一等 client / first-party 仅 Eden / shared Zod camelCase SSOT（治理与结构约定）
- generation-core r160/r164：确定性节点管线顺序 / stream-non-stream 共享（架构链路与复用约束）
- typed-generation-framework r328：扩展位治理（r323/r325/r327 已随 c122 升格为可执行场景）
- generation-observability r180：重试边界不堆叠（架构边界）
- deep-research-runtime r78/r79：合约对齐 Lab design / Lab-only extras 文档化（治理元条款）

### 治理与流程约束（14 条）

- source-aware-generation-modes r241 随 capability 移除（c121）；generation-presets-and-constraints r187（预设不得反向定义生成类型）
- chat-prompt-presets ——（无）
- quality-and-regression r222：remote CI optional（流程治理）
- configuration-governance r31/r33/r35/r36：CL_* 命名 / typed accessor 禁解构 / 超时上限走 config / YAML snake_case（治理与命名约定）
- web-ui-foundation r159：Rstest fixtures camelCase（夹具治理）
- public-repo-hygiene r209：security disclosure policy（DEFERRED 治理项）；r211：项目元数据一致性（表述性）
- deep-research-ui r119：Lab 经 Eden + shared schemas（wire SSOT 治理）；r150：cl-prd-demo skill 文档治理
- source-ingestion-upload-and-url r294：extractor fallback canonical（纯委托 web-extractor-plugins 的治理条款）
- output-rendering-and-typing r200：RenderDescriptor 合约稳定（治理性承诺）
- workspace-ui-core r390/r393：弹层统一策略 / 面板合约归属（治理条款）
- chat-prompt-presets ——（本 capability 无 C 类）

### 表述与视觉类（2 条）

- web-ui-foundation r343：tokens 对齐既有设计系统（视觉一致性属人工评审）
