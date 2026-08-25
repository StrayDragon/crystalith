# Design — specs-compact-2026-08-b3

## D0 基线数据（2026-08-26 盘点）

- 35 capability / 950 场景 / 全部 `@human`、0 `@executable`；其中 **542 个双写残留**
  （首行 `- 必须成立：…` 摘要 + 随后逐字重复一遍 假如/当/那么）。
- 目标：场景总数 ≈478（区间 453–503）；每个 requirement ≥1 有效 scenario；
  requirement 标题保持稳定；req_id 不删除（仅极少数经 D2 明确改写）。

## D1 场景级合并操作模式

### Pattern A · 1:1 镜像删除（约占双写 85%）

识别器：同 requirement 下两个场景，其一为描述性命名（如 `Legacy envelope is never emitted…`），
另一为机械命名（kebab-case 英文 / `s1` `s2` / `happy` / `qa_unit_dir` 等）且正文带 `- 必须成立：`。
若机械场景是描述性正文的逐句翻译（完全等价）→ **整段删除机械场景**。
若机械场景含增量语义（错误码、端点名、负面用例、额外子句）→ 先把增量子句并入保留场景正文，再删除。

### Pattern B · 1:N 分解收敛（deep-research-* / workspace-api-contract / generation-core /

retrieval-and-cache / workspace-ui-panels 为主）

一个稠密描述性段落被拆成 2–4 个机械场景。逐条判断：

- 纯重述（机械内容 ⊆ 描述性正文）→ 删除；
- 含可观察行为增量 → 去噪后保留（全仓预计保留 60–80 个此类实例，典型：runtime r316 三个闭包
  实例、api-contract r63 的 409/404 错误码、r273 幂等/revision 冲突）。

### 双写去噪（对所有保留场景生效）

保留场景必须是**单一形态**，二选一：

- **Form-D**：`场景: <标题>` + 单条 `- <MUST/SHALL 陈述>` bullet；
- **Form-G**：`场景: <标题>` + 假如/当/那么 行（仅 `@executable` 场景使用）。

禁止 `- 必须成立：当 X；那么 Y` 后再逐字重复行。由双写转 Form-D 时：去掉重复行与
`必须成立：`前缀，语义合并为一条陈述。保留场景标题不改。

### 硬性约束

1. requirement 头注释块（`# language/# capability/# purpose/# scope`）与 `功能:` 行不动
   （除非 D2 点名）。
2. 每个 requirement 至少 1 个 scenario；被删场景的 req_id 若无其他场景则把其语义并入同组保留场景。
3. 不新增/删除 requirement（`@req:<id> @human` 行数不变），除 D2 明确点名的改写。
4. zh-CN；保留的 @human 陈述须含 MUST/SHALL/必须/不得。
5. 只编辑指派的 `.feature` 文件；不运行 git 命令；不改代码与测试。

## D2 跨 capability 处置表（G1–G13 + 孤立重复簇）

引用语风格沿用现例：「……见 `<capability>` r<N>」或标注 canonical（先例：deep-research-ui r82
「本条为此禁令的 canonical 约束」）。两侧义务并存时双侧保留 + 补引用（同 b2 R17 原则）。

| 组                               | 处置                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 提取器 fallback 链            | canonical=web-extractor-plugins r113/r217。si-upload r61 及场景 extractor-fallback-is-controlled、r72 及场景 preferred-extractor-unavailable-is-explained 改写为引用语（保留各自特有断言一句），删除对应机械镜像                                                                                                                                                                                               |
| G2 OpenAPI/AsyncAPI↔handler 同步 | canonical=openapi `openapi-route-docs-stay-synced` / `asyncapi-stream-verbs-match-handlers`。api-contract `openapi-docs-match-handler-paths` 整条场景删除、requirement 陈述改引用；api-contract `progress-streams-use-get` 删尾句登记同步子句（保留 SSE 用 GET 本体）。out-render `outputs-response-contract` 尾句「MUST NOT 再登记扁平 /v2/outputs」改引用 openapi `openapi-documents-nested-canonical-paths` |
| G3 assistant content 纯文本      | canonical=chat-envelope r26/r84。api-contract r262、ui-panels r246、presets r248 中与 envelope/sharedState 重复的子句改为句尾引用「（见 chat-ui-envelope r26/r84）」，各自特有义务保留                                                                                                                                                                                                                         |
| G4 CSV 契约                      | canonical=si-core（csv-parser-markdown-table 一族）。si-upload r212+large-csv-produces-multiple-chunks 改引用；si-conv `csv-parser-must-escape-cells` 条目迁入 si-core（转义规则并入其 CSV requirement 正文），si-conv 侧删除                                                                                                                                                                                  |
| G5 来源删除=DB+向量同删          | canonical=si-core r209。si-manage r178 前半句改引用，保留 re-embed 独有后半句                                                                                                                                                                                                                                                                                                                                  |
| G6 tag 批量逐项结果              | canonical=si-manage r268/tag-binding-response-and-ownership。si-conv `tag-binding-must-return-per-item-diagnostics` 及场景 tag-binding-missing-source 改引用后删除复述                                                                                                                                                                                                                                         |
| G7 转换 lineage                  | canonical=xform r86/r159。si-conv r179 句尾加「lineage 语义见 cross-type-result-transformations r86」。附带：xform 内 `session-get-single`、`session-convert-citation-chunks` 两条纯 session-API 场景保留原位（本轮不做跨文件迁移）                                                                                                                                                                            |
| G8 citation 清洗 postprocess     | canonical=gen-core r250。typed-gen `outputs-citations-must-be-sanitized` 改引用（_warnings/_postprocessed 标记细节保留在引用句内）；`outputs-quality-preference-must-trigger-llm-repair` 同法对齐 gen-core 管线阶段                                                                                                                                                                                            |
| G9 AI 重试策略分裂               | canonical=observability（retry-honors-retry-after/retry-timeout-budget/r198）。arch-plugin r247 保留 middleware 职责句，策略细节（次数/退避）改引用 observability；observability 侧补一句「middleware 承载重试，见 architecture-plugin-and-agent r247」                                                                                                                                                        |
| G10 preference→检索参数          | canonical=gen-core r126/r162。slides-wf（studio-slides-workflow）`studio-generation-config-must-expand-to-ranges` 中 preference 调节子句改引用，quantity/density 区间展开保留                                                                                                                                                                                                                                  |
| G11 depth 档位映射               | canonical=dr-runtime r305。dr-ui r447 及场景 depth-budget-mapping-configurable 保留「POST body 显式携带所选 depth」断言，其余映射/默认档位表述改引用                                                                                                                                                                                                                                                           |
| G12 门禁组成双写                 | canonical=quality r_bdd_optional 与 r99/r172。bdd r120 陈述保留 BDD 自身范围声明、门禁归属改引用 quality，删场景 s3；bdd `r_integration_tests` 陈述改引用 quality r99/r172，机械场景 qa_unit_dir 收敛为 1                                                                                                                                                                                                      |
| G13 导出 sources meta 形状       | canonical=api-contract `qa-export-endpoint`。out-render `outputs-export-fields` 的 sources meta 字段集部分改引用，citations 字段集保留                                                                                                                                                                                                                                                                         |

### 孤立重复簇（capability 内、跨 requirement）

| 簇                                                                            | 处置                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| api-contract r114 ≡ r218（health 匿名可达）                                   | 各留 1 场景：r114 为 canonical 断言；r218 场景聚焦 guardrails-enabled 语境并引用 r114                            |
| api-contract r69 尾句事件稳定性 ≈ r73 两机械                                  | 事件最小集 canonical 归 r73；r69 删尾句                                                                          |
| dr-ui r417≡r439；r408≡r432；r419≈r441≈r451                                    | 各组合并为 1 场景（canonical 用通用面版本，Eden 版差异点并入正文）                                               |
| gen-core r89 ≈ qa-retrieve-before-generate 机械（ungrounded-empty-selection） | 合 1，保留空 selection→ungrounded 断言一次                                                                       |
| si-core r105 vs r2_sync                                                       | 不合并；确保两条陈述显式分工：r105=ready⇒可检索结果语义；r2_sync=ready 前同步完成时序                            |
| openapi r37 ≈ r95                                                             | 两 requirement 保留但去重：r37=Eden treaty 与 OpenAPI 文档同源共存；r95=MUST NOT 平行一等 generated client；互引 |
| configuration-governance r27 `happy` ≡ `precedence_env_overrides_yaml`        | 同 requirement 内二选一保留                                                                                      |

## D3 @executable 第一批（标签先行）

约束：只转写**现有步骤词汇**可表达的场景（词汇表=`apps/server/tests/bdd/steps/common.ts`，
参照 `apps/server/tests/bdd/features/<domain>/*.feature` 的既有编排顺序）；步骤引号用 ASCII `"`;
路径模板语法照抄现有 features 用法；不确定的字面期望值只断言状态码。转换方式：将该 requirement
下最贴合的伪 GWT 场景改写为 `@req:<id> @executable`（Form-G），同 requirement 其余场景保持
`@human`。本轮 runner 不接线（纯标签追溯），故文本允许后续微调。

| #   | 文件         | req                                   | 新 executable 场景（参考形状）                                                                                                             |
| --- | ------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| X1  | si-manage    | tags-uniqueness-and-ownership         | 假如 一个空白笔记本／而且 已存在来源标签"Research"／当 创建一个名为"research"的来源标签／那么 响应状态码为409                              |
| X2  | si-manage    | tags-assign-idempotent                | 假如 笔记本中有一篇来源"notes.md"／而且 已存在来源标签"core"／当 将该标签分配给当前来源／而且 将该标签分配给当前来源／那么 响应状态码为200 |
| X3  | si-manage    | sources-reembed-requires-failed       | ready 来源 + 泛型 POST …/re-embed → 响应状态码为400（路径模板照抄现有 features 用法；若无先例则用具体 URL 占位并在场景标题注明待接线校准） |
| X4  | api-contract | r244                                  | 镜像 tests/bdd/features/sessions「跨笔记本访问会话返回404」的步骤序列                                                                      |
| X5  | api-contract | param-format-validation-envelope      | 泛型 GET `/v2/notebooks/abc/sources` → 响应状态码为422（或实际信封码，查 router 后定）                                                     |
| X6  | api-contract | list-endpoints-use-paginated-envelope | 一个空白笔记本＋一个空白会话＋使用分页参数limit=1请求消息列表 → 200＋包含"total"字段＋"items"为列表                                        |
| X7  | api-contract | r151                                  | 触发任一 404 → 响应错误码断言（字面值查 router 定，不确定则仅断言 404）                                                                    |
| X8  | commands     | r57                                   | 已启动应用／请求命令列表／200＋至少包含1条记录                                                                                             |
| X9  | commands     | r187                                  | 已启动应用／请求命令列表／列表按"trigger"升序排列（多次请求稳定性留在 @human 陈述）                                                        |
| X10 | commands     | r152                                  | 已启动应用／请求命令列表／存在来源为"builtin"的命令＋存在触发词为"/prompt:stats"的命令（kind/enabled 子句留在 @human 陈述）                |

deferred（需新步骤/基建，本轮保持 @human）：upload 族（需上传 When 步）、SSE 族、config 注入族、
connectors、data-and-storage 选型/性能项（后者建议未来转 @manual）。

## D4 守则违规顺手修复

- data-and-storage `sqlitevec-topk-latency`：p50<10ms/top-10/1万 chunk 性能断言删除，
  改写为行为语义（「向量检索延迟与召回规模目标 MUST 由配置/基准测试承载，spec 不锚定数值」）。
- studio-slides-workflow r183：「默认 10min，可配置」已是 config 表述，保留。
- architecture-plugin-and-agent r118 语气冲突：机械场景 `agent-multi-tool-loop` 以 SHALL 断言
  与描述性 DEFERRED/MAY 冲突 → 合并时以 DEFERRED/MAY 为准。
- source-ingestion-summary-and-conversion「而非前 15 个」：魔法数字 → 「按相关度排序返回，
  MUST NOT 以固定截断数量替代检索排序」。

## D5 计数纪律与验证

- 每 capability 目标数见 tasks.md 台账；完成后逐一核对（grep -c '@req:' <file>）。
- 总量验收：`grep -rh "@req:" llmanspec/specs --include="*.feature" | wc -l` ∈ [453, 503]，
  其中 `@executable` 计数 = 10（X1–X10）。
- `llman sdd validate --specs --strict --no-interactive` 全绿；被删场景标题 grep 无残留引用。
- `just test-bdd` 应保持原有通过集（runner 未动；specs 不在其扫描根）。

## 回滚边界

仅 `llmanspec/specs/**` 与 change 文档；单 revert 即完全回滚，无代码/wire 影响。
