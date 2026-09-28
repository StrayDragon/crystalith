# Specs 裸规则压降作战地图（llman-sdd 0.5 pending 计量）

> 状态：**B 区主体完成（2026-09-28）**。pending **448 → 126**：c111 试点（13）→ c112 碰撞修复 → c113 非深研 A 类（118）→ c114 深研双雄 A 类（121）→ c115 API 合约（16）→ c116 门禁/服务侧（26）→ c117 摄取/抽取/深研运行时（23）→ c118 前端组件区（18）。剩余 126 条 = **产品缺口 ~32**（spec 有 MUST 而实现不存在：r345/r351、r422/r423/r24/r166、r287/r464/r465/r290/r295、r405/r411/r413/r416/r417、r322/r324 等——处置为实现落地或修合约）+ **spec 领先实现 12**（cross-type 7、source-aware 5，待实现后按 A 类流程补场景）+ **顺延 ~35**（deep-research-ui 9、studio-output-types 6、generation-observability 7、retrieval 余量等可测未测项）+ **C 47**（豁免台账见下）。
> 删除条件：全部批次完成后（review `pending` 信号只剩有记录豁免的 C 类裸规则）本档转为纯记录，或随 specs-compact 收敛后删除。

## 背景

llman-sdd 0.5 原生分层格式下，规则（`规则:` 块 + `@req` 句柄）的首选形态是带嵌套 `场景:`（可执行 GWT）；无嵌套场景的**裸规则**合法但需记录理由，并以 review `pending` 信号计量，交 specs-compact / 补场景压降。0.4→0.5 迁移后全仓 **461 条裸规则 / 35 capability**。

## P0 前置：req_id 碰撞修复 ✅ 已完成（c112，merge 17d4cf08）

历史「重排全局 req id」遗漏导致同一文件内多个规则头共用同一 `@req` 编号。句柄系统（resolve-req / review 报告 / 锁定报告 / 归档引用）依赖全局唯一，**补场景锚定 @req 前必须先修复**。

- 规模：**45 个碰撞 tag / 54 处需重取号 / 11 个文件**（重灾区 deep-research-ui 18、deep-research-runtime 14）。
- 详细清单（tag → 行号 → 规则标题）：见本文末尾附录。
- **上游工具缺口**（llman-sdd 0.5.0，两处均未报出）：
  1. `validate` 的「全局重复 req_id」ERROR 门未检测同文件内碰撞（如 deep-research-ui L8/L176 同挂 r99，validate 判 valid）；
  2. `project dedupe-req-ids --dry-run` 报 "No colliding req_id values"（疑似只查跨文件）。
- 处置：c112 已按 `spec next-req-id` 重取号（首现保留原号，后续 → r420-r473），本地 `just check-req-ids` 复扫为 0；上游两处漏报仍待报 llman-sdd 修复。

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
| 4   | source-aware-generation-modes           | 7               | 0   | 5   | 2   | r243 重号已修（c111）；r39-r43 类似区块 spec 领先实现                                                                             |
| 5   | openapi-and-client-generation           | 7               | 4   | 0   | 3   | parity/asyncapi 测试可直接锚定                                                                                                    |
| 6   | data-and-storage                        | 7               | 2   | 2   | 3   | r46-r48 选型决策合法裸规则                                                                                                        |
| 7   | cross-type-result-transformations       | 7               | 0   | 7   | 0   | 整块 spec 领先实现（无 transform/lineage 代码）                                                                                   |
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

| 批次                             | 状态               | 结果                                                                                                                                                                                             |
| -------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~c111 试点~~ ✅                 | merge 96345d55     | 5 capability 13 场景 + runner 规则块下钻 + bdd.run_command                                                                                                                                       |
| ~~c112（P0 碰撞）~~ ✅           | merge 17d4cf08     | 54 处重号 r420-r473 + `just check-req-ids` 自检；上游漏报已报 [llman-sdd#4](https://github.com/StrayDragon/llman-sdd/issues/4)                                                                   |
| ~~c113 非深研 A 类~~ ✅          | merge f99e81ab     | 118 场景                                                                                                                                                                                         |
| ~~c114 深研双雄 A 类~~ ✅        | merge 6cd6c2fa     | 121 场景                                                                                                                                                                                         |
| ~~c115 API 合约 B 区~~ ✅        | merge bd01ed1e     | 16 覆盖 + 28 集成测试；缺口 r345（鉴权未实现）/r351（UI state 端点不存在，牵动 chat-ui-envelope r29 合约）                                                                                       |
| ~~c116 门禁/服务侧~~ ✅          | merge 1669e7ac     | 26 覆盖（门禁组成锁测 9 全中）；缺口 r422/r423/r24/r166                                                                                                                                          |
| ~~c117 摄取/抽取/深研运行时~~ ✅ | merge 692a3bc3     | 23 覆盖；缺口 r287/r464/r465（markdown 预处理未实现）/r290（空文件上传 200/ready/0-chunk 缺陷）/r295/r469 半边（415 路径不存在）/r334 合取未算                                                   |
| ~~c118 前端组件区~~ ✅           | merge 51cbfd87     | 18 覆盖（panels 12 + ui-core 5 + r158 负向扫描）；web 测试 339→371；缺口 r405/r411/r413/r416/r417（前端无对应实现）                                                                              |
| **顺延（未开批）**               | 待下一会话         | deep-research-ui 交互 9（r101/r102/r111/r117/r148 等）、studio-output-types 6（r299-r303/r306，r306 为 server FK 可先做）、generation-observability 7（r176-r179/r182-r184）、retrieval/其余散量 |
| **spec 领先实现**                | 转入待实现         | cross-type 7、source-aware 5——实现落地后按 A 类流程补场景                                                                                                                                        |
| 持续                             | C 类 47 条豁免台账 | 见下节；specs-compact 时机再评估合并                                                                                                                                                             |

## 附录：req_id 碰撞清单（45 个 tag）

> 碰撞清单已于 c112 全量修复（54 处重号，首现保留、后续 r420-r473），本文原附录按文档纪律删除。复核命令：`just check-req-ids`（应报 OK）；上游 validate 漏报修复后可迁移为其全局门。

## C 类豁免台账（47 条，保留裸规则的记录）

> 判据：架构决策 / 治理约束 / 选型声明 / 愿景叙述，无法（完全）程序判定，强写 GWT 会失真。后续若有条款获得可程序判定口径（如新增静态检查），随时升格补场景。

### 选型与架构决策（26 条）

- architecture-core r1-r6：feature 切片 / 依赖方向 / 路由聚合 / 前端 domain 切片 / app-shared 薄边界 / Zustand 分片（结构约束）
- architecture-plugin-and-agent r9/r10/r12：AI SDK v7 / 官方 @ai-sdk/* providers / generateObject+Zod（技术选型）
- architecture-plugin-and-agent r11：agent loop DEFERRED（延期声明）；r15：middleware 职责叙述
- data-and-storage r46/r47/r48：单 SQLite 文件 / Drizzle ORM / Drizzle Kit（选型与流程约束）
- deep-research-runtime r53：ResearchRun process SSOT；r56：共享 webSearch tool only（架构决策）
- openapi-and-client-generation r190/r191/r192：Eden 一等 client / first-party 仅 Eden / shared Zod camelCase SSOT（治理与结构约定）
- generation-core r160/r164：确定性节点管线顺序 / stream-non-stream 共享（架构链路与复用约束）
- typed-generation-framework r323/r325/r327/r328：显式绑定类型 / 最小类型契约 / 生成-输出边界 / 扩展位治理
- generation-observability r180：重试边界不堆叠（架构边界）
- deep-research-runtime r78/r79：合约对齐 Lab design / Lab-only extras 文档化（治理元条款）

### 治理与流程约束（19 条）

- source-aware-generation-modes r241（不得反向重写上游对象模型）、r187（预设不得反向定义生成类型）
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
- source-aware-generation-modes r244：来源模式标签不暴露内部术语（UI 文案表述）
