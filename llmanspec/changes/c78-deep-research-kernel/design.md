# Design: c78 Deep Research kernel（API 优先 · 薄前端）

> **状态**：§3 API **已锁 A+B+C（2026-07-23）** · 调研 §7.1–7.4 已确认 · 可按 tasks 波次 Apply
> **产品姿态**：Demo 保机制；观感可后打磨。重逻辑进后端 SSOT。

## 1. 分工（可维护性原则）

| 层                   | 负责                                                                         | 禁止                                      |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| **后端 ResearchRun** | 图拓扑、剪枝闭包、fork/confirm、内核、预算、证据、权威 report、**revisions** | 依赖 FE 算权威闭包或补全 DAG              |
| **Shared Zod**       | HTTP/Eden/OpenAPI 与（同形）LLM 结构化输出                                   | 同名异形第二份 schema                     |
| **Desk / Lab 展示**  | 渲染、二次确认、命令口、可丢弃预览、画布偏好                                 | 本地伪造权威 graph；timer 冒充 Run 状态机 |
| **节点 chat**        | 流式正文 + **ActionProposal**；accept→命令口                                 | 自动改图；另起平行突变通道                |

**迭代策略**：新能力优先加 **命令口 / 事件字段**，不开放「任意 patch 整图」。

## 2. 现有衔接（不推翻）

```text
POST/GET research · GET stream · POST confirm|cancel
POST …/nodes/:id/prune|fork · POST convert-*
+ PATCH …/nodes/:id
+ POST …/nodes/:id/chat（SSE）
+ revisions 列表/创建/读（见 §3.2）
SSE(Run): status | graph_patch | confirm | report_ready | log | error
```

内核替换 `runLoop` stub；prune/M1/EV1/convert **继续复用**。Lab 丢掉 phase 定时回放权威态。

## 3. API 交互口 — **已确认 A+B+C（2026-07-23）**

### 3.1 A · 稳定命令口（收紧语义）

| 端口                           | FE 机制     | 后端 SSOT（c78）                          |
| ------------------------------ | ----------- | ----------------------------------------- |
| `POST …/research`              | 创建        | 种子 **1 question + 1 conclusion**        |
| `GET …/research/:rid`          | 快照        | `nodes[].role?`、完整 edges               |
| `GET …/stream`                 | 实时图/状态 | patch 带 role；**不**推报告/chat token    |
| `POST …/confirm`               | M1          | approve → **merge→conclusion**            |
| `POST …/cancel`                | 停止        | Abort 单元 + 顺带 abort chat + checkpoint |
| `POST …/nodes/:id/prune\|fork` | 剪枝/分叉   | r316；role 保护；fork→M1                  |
| `POST …/convert-to-*`          | 转化        | 不变                                      |

读模型权威：`GET` + Run SSE。预览可本地；提交后以服务端为准。

### 3.2 B · PATCH + C · chat / revisions / 画布

| 端口                               | 范围       | Body / 行为                                                                                                                                                         |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B** `PATCH …/nodes/:nodeId`      | live only  | `{ title?, query?, conclusionStatus? }` 至少一项；pruned/保护节点拒绝                                                                                               |
| **C1** `POST …/nodes/:nodeId/chat` | SSE 短轮   | `{ message }` → `chunk` / `proposal` / `done` / `error`；§7.3 双通道；Structure 须确认；accept→A/B 命令口                                                           |
| **C2** revisions                   | Run 作用域 | `GET …/revisions`、`POST …/revisions`（快照当前 graph+report）、`GET …/revisions/:revId`；可选恢复=写回 graph/report + `graph_patch`（≠ checkpoint 内部恢复元数据） |
| **C3** 画布机制                    | FE         | Desk 迁入 Lab 画布偏好（方向/算法/小地图）；**纯客户端**，可 localStorage；无新编排 API                                                                             |

### 3.3 事件与字段

| 字段/事件           | 说明                                  |
| ------------------- | ------------------------------------- |
| `ResearchNode.role` | optional + 前缀兼容                   |
| `graph_patch`       | upsert 含 role/phase/conclusionStatus |
| 失败汇入文案        | 展示层派生（r414）                    |
| chat SSE            | 独立于 Run stream（§7.3）             |

### 3.4 红线（仍拒绝）

1. `PUT …/graph` 整图上传
2. 客户端权威剪枝闭包列表
3. chat 内嵌任意 JSON patch 改图
4. 平行 research error 命名空间
5. 报告/chat 正文 token 进 **Run** stream（r311）

### 3.5 FE 机制 ↔ 端口

| Demo 机制            | 正式口                       |
| -------------------- | ---------------------------- |
| 选节点 / pruned 弱化 | GET + Run SSE + r414         |
| 剪枝 / 分叉          | prune / fork→confirm         |
| M1 确认              | confirm                      |
| 取消                 | cancel                       |
| 改 query / 状态      | **PATCH**                    |
| 节点聊天             | **POST chat**；accept→命令口 |
| 报告多版本 / CoW     | **revisions**                |
| 画布方向/小地图      | **C3 FE 偏好**               |
| 转笔记/来源          | convert-*                    |

## 4. 内核（后端）

```text
scheduleRun
  └─ serial work-units + ResearchNodeAgent(mode=work_unit)
       XOR node chat (mode=node_chat) per §7.3
```

Apply 波次：**A 内核+DAG → B PATCH → C1 chat → C2 revisions → C3 画布**。LLM 不拥有图。

## 5. 已锁定默认

| 项                    | 锁定                                                              |
| --------------------- | ----------------------------------------------------------------- |
| 编排                  | CP1 + Abort；P0 串行；同 Run LLM 互斥                             |
| role                  | optional + 兼容                                                   |
| conclusion            | 开跑即 seed                                                       |
| fork                  | fork/expand + merge→conclusion                                    |
| Agent                 | 单 ToolLoopAgent + prepareCall(mode)                              |
| API                   | **A+B+C 全做**                                                    |
| 数据面 §8             | **已确认**（working 落库 + progress SSE；终态账本保留最近 N=200） |
| 报告 token→Run stream | **不做**                                                          |

## 6. 风险

- 范围大：严格按 A→B→C 波次，每波可测
- revisions ≠ checkpoint（用户快照 vs 内部恢复元数据）
- chat 与自研互斥需短拒/文案
- PATCH 与 prune 竞态：拒绝已 pruned

## 7. 调研笔记（一次一题）

### 7.1 节点 agent 循环：AI SDK vs pi-agent-core — **已结**

**问题**：每个节点要能自研究、可中断、对话里用内置 tool 影响图（剪枝/分叉）。Vercel AI 是否具备 pi-agent-core 式循环？

**证据（本仓库 `ai@7.0.17` 自带 docs）**

| 能力             | pi-agent-core（概念） | AI SDK v7（已安装）                                            |
| ---------------- | --------------------- | -------------------------------------------------------------- |
| LLM↔tool 循环    | `agent_loop`          | **`ToolLoopAgent`**（`generate` / `stream`）                   |
| 停条件           | 自定义                | `stopWhen`: `isStepCount` / `hasToolCall` / 自定义             |
| 步间改上下文     | steering 队列         | **`prepareStep`** + `runtimeContext`                           |
| 敏感动作人工确认 | 应用层                | **`toolApproval: 'user-approval'`**（停等用户）                |
| 中断             | asyncio cancel        | **`abortSignal`**（`generate`/`stream`/`createAgentUIStream`） |
| 流式 UI          | 自建事件              | `stream` + `createAgentUIStream`（可选）                       |

另：AI SDK 还有 **`HarnessAgent`**，可挂 Claude Code / Codex / **Pi** 等外部 harness——那是「跑别人的 agent 运行时」，**不是**我们要的自建节点循环。根规范已放宽为慎用（须 design 论证）；**本 change 默认不走 Harness+Pi**。

仓库已有轻量先例：`apps/server/src/ai/stream.ts` 用 `streamText` + `stopWhen: isStepCount(n)` 做 QA tool 环——节点研究可同模式，或升格为 `ToolLoopAgent` 封装。

**结论（锁定进 c78 设计）** — §7.1 **已确认（2026-07-23）**

1. **依赖默认**：节点级 agent 环用现有 **`ai` → `ToolLoopAgent`（或等价 `streamText`+tools+`stopWhen`）**；不加 Pi。其它框架见根 `AGENTS.md`「AI SDK v7 First」——须 design 论证，非常规默认。
2. **职责切分**：`ResearchRun` 内核仍管 **DAG 调度 / CP1 / prune·fork 命令 SSOT**；`ToolLoopAgent` 只跑 **单个节点的一轮工作或一轮对话**，不拥有整图。
3. **剪枝/分叉 tool 不得静默改图**（对齐 Lab）：
   - **推荐 A**：tool 无 `execute` 或 `toolApproval: 'user-approval'` → 前端确认后打既有 `POST …/prune|fork`；或
   - **推荐 B**（更贴 Lab）：模型只产出 **ActionProposal**，accept → 命令口（chat HTTP 仍可后置）。
   - **禁止**：tool `execute` 里直接改 DB 图且无用户确认（与 r406 二次确认、命令口 SSOT 冲突）。
4. **中断**：节点单元 / 对话流传入同一套 `AbortSignal`（cancel Run 或 prune 活动节点时 `abort()`）；DAG 层仍 CP1 协作。
5. **与「每个节点自研究」关系**：调度器串行点名节点 → 该节点起一次短 `ToolLoopAgent`（检索/综合 tools）→ 写回节点字段 + `graph_patch`；用户点开节点聊天 = 另一次 scoped agent（tools 目录按 `role` 裁剪）。

**编排依赖政策（放宽说明）**：早期 Banned 是为防 v2 迁移期多套编排抢 SSOT（c76 design 亦写「禁 LangGraph/Mastra」）。现根规范已改为 **AI SDK First + 慎用清单**；本 change 仍默认 ToolLoopAgent，不引入 Pi/Mastra/LangGraph。

### 7.2 节点内置 tool 清单与剪枝/分叉审批 — **已结**

**问题**：自研节点 / 节点对话里，哪些是「可自动执行」的 tool，哪些必须走用户确认才能动图？

**既有可复用（server）**

| Tool                      | 路径                                           | 今日用途            |
| ------------------------- | ---------------------------------------------- | ------------------- |
| `retrieveSources`         | `apps/server/src/ai/tools/retrieve-sources.ts` | 笔记本 RAG          |
| `webSearch` / `searchWeb` | `apps/server/src/ai/tools/web-search.ts`       | 外网（r303 单实现） |

Lab 交互目录（非 SDK tool，但是产品动作闭集）：`nodeChatTypes.ts` / `nodeQuickActions.ts`
`prune_node` · `fork_sibling` · `rewrite_query` · `set_status` · `confirm_finish` · `confirm_continue` · `open_report`

**两类 tool（锁定）**

```text
┌─ Work tools（自动 execute）──────────────┐
│  notebook_retrieve / web_search          │
│  → 写 evidence、刷新节点 phase/摘要候选项 │
│  → 不直接 prune/fork/改拓扑              │
└──────────────────────────────────────────┘
┌─ Structure intents（禁止静默改图）───────┐
│  propose_prune / propose_fork            │
│  propose_rewrite_query / propose_set_status
│  propose_confirm_*                       │
│  → 输出提案或 toolApproval 等待用户      │
│  → accept 后只打 §3 命令口               │
└──────────────────────────────────────────┘
```

| 意图                                       | SDK 侧                                                                                  | 用户确认后                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 笔记本检索                                 | Work tool · 可 auto `execute`                                                           | （无图拓扑变更；内核写 evidence + patch）                   |
| 外网搜索                                   | 同上；计入 `searchesUsed` / 可触发 M1 budget                                            | 预算硬停仍走 `confirm`                                      |
| 综合摘要 / 定 conclusionStatus（自研单元） | **优先非 tool**：单元末 `generateText`+`Output.object` 写回；对话里若要改态 → Structure | 自研单元写回免二次确认；**对话改态**要确认或快捷徽章 accept |
| 剪枝                                       | Structure：`toolApproval:'user-approval'` **或** 无 execute 的 propose                  | `POST …/prune`                                              |
| 分叉                                       | 同上（可带 title/query hint）                                                           | `POST …/fork` → M1 `approve_branch`                         |
| 改 query / 标题                            | Structure →                                                                             | `PATCH …/nodes/:id`（若已锁口）                             |
| 继续 / 出报告                              | Structure →                                                                             | `POST …/confirm`                                            |
| 打开报告                                   | **非 tool**（纯 FE 导航）                                                               | —                                                           |

**按 `role` 裁剪 `activeTools`（对齐 Lab catalog）**

| role         | Work                    | Structure                               |
| ------------ | ----------------------- | --------------------------------------- |
| `question`   | retrieve/search（可选） | rewrite_query, confirm_*                |
| `research`   | retrieve/search         | prune, fork, rewrite_query, set_status  |
| `conclusion` | 通常无检索              | set_status, confirm_*,（FE）open_report |

**自研单元 vs 节点对话（同一 tool 实现、两种入口）**

|            | 自研 work-unit（调度器触发）       | 节点对话（用户触发）             |
| ---------- | ---------------------------------- | -------------------------------- |
| Work tools | 默认可跑；受预算/abort             | 用户问「再搜一下」时可跑         |
| Structure  | **默认不挂**（避免无人值守改拓扑） | **挂上**；必须审批/提案          |
| 停条件     | `isStepCount(小)` + 有摘要即停     | `isStepCount` + 用户结束 / abort |

**依赖**：无新库；复用 `tool()` + 既有 retrieve/webSearch；Structure 用 AI SDK `toolApproval` 或 Lab 式 proposal 卡片（产品二选一实现，语义等价）。

**本笔记不展开**（下一题 7.3）：节点对话 SSE 与 Run `stream` 并存、abort 作用域。

### 7.3 节点对话 SSE / abort 与 Run stream 并存 — **已结**

**问题**：Run 已有长连接 `GET …/research/:rid/stream`；节点对话要流式正文 + 提案/审批。二者怎么并存、abort 各自管什么？

**现状锚点**

| 面           | 实现                                                      | 约定                                                                             |
| ------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Run 进度总线 | `createResearchSseResponse` · Desk `useResearchRunDetail` | GET；事件：`status`/`graph_patch`/`confirm`/`report_ready`/`log`/`error`（r311） |
| QA 交互生成  | `streamRequest` POST + body                               | c70：交互生成用 POST；资源进度用 GET                                             |
| FE 取消订阅  | `AbortController` 关详情时 abort fetch                    | **不断开服务端 Run**，只断客户端订阅                                             |

**结论（锁定）**

#### 1. 双通道，不把 chat token 塞进 Run stream

```text
  Desk 详情
    ├─ GET  …/research/:rid/stream     ← 图/状态/M1/日志（长连接）
    └─ POST …/nodes/:nodeId/chat       ← 单轮对话流（短连接；实现可后置）
              body: { message }
              SSE:  text 增量 + proposals|tool-approval + done|error
```

| 为何分开  | 理由                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| r311      | Run stream **禁止**推报告正文 token；节点 chat 正文同属「生成流」，勿污染进度总线 |
| 生命周期  | Run stream 跨整个非终态 Run；chat 按「用户发一条 → 一轮结束」关闭                 |
| FE 复杂度 | 详情 hook 继续只解析 `ResearchStreamEvent`；节点抽屉另开 chat abort/解析          |
| c70       | 交互生成 = POST；既有资源进度 = GET — 与 QA 一致                                  |

Accept Structure 提案后仍打 §3 命令口；**图变更只经 Run stream 的 `graph_patch`/`confirm`/`status` 回写**（chat SSE 不发权威图补丁）。

#### 2. Abort 作用域（三层）

| 信号                    | 触发                                         | 效果                                                                                        |
| ----------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **A · 客户端 Run 订阅** | 关详情 / 换 Run                              | 只 `abort()` GET stream fetch；**不** cancel Run                                            |
| **B · 节点 chat 轮次**  | 用户点停、关抽屉、发下一条前取消上一条       | `abort()` 该 POST chat；丢弃半截正文/提案；**不**改图、**不** cancel Run                    |
| **C · Run / 活动单元**  | `POST cancel`；或 prune 命中当前自研活动节点 | `cancelRequested` + Abort 自研 work-unit；**顺带 abort 该 Run 上进行中的节点 chat**（若有） |

实现提示：server 侧 `Map<runId, AbortController>`（自研）与 `Map<`${runId}:${nodeId}`, AbortController>`（chat）可分表；C 触发时两者都 abort。

#### 3. 并发（P0 简单规则）

与 §7.1 串行内核一致：

- **同一 Run 同一时刻只允许一个 LLM 活动**：自研 work-unit **XOR** 节点 chat。
- 用户开 chat 时：若该 Run 有活动单元 → **排队 chat** 或 **短拒**（产品选一；推荐短拒 + toast「节点仍在研究中」）；反之 chat 进行中调度器 **不抢** 同 Run 新单元（可继续其它节点？→ P0 更简单：**整 Run 互斥**）。
- Structure accept → REST 与 Run stream 并行无妨（非 LLM）。

#### 4. Chat SSE 事件最小集（合约草稿，实现可后置）

```text
event: chunk          data: { text: string }           // 或对齐 QA chunk
event: proposal       data: ActionProposal | tool-approval-request
event: done           data: { proposals?: ... }
event: error          data: ErrorEnvelope 字段子集
```

不要求本 change 立刻挂路由；**通道分离 + abort 分层**先锁，避免以后把 token 焊进 Run stream。

**依赖**：无新库；复用 `streamRequest` / 现有 SSE 头；可选日后 `createAgentUIStream`（仍走独立 POST）。

**本笔记不展开**（下一题 7.4）：自研 work-unit 与 chat 是否共用同一 `ToolLoopAgent` 定义。

### 7.4 自研 work-unit 与 chat 是否共用 Agent — **已结（已确认 2026-07-23）**

**问题**：调度器触发的「节点自研」和用户触发的「节点对话」要不要同一个 `ToolLoopAgent` 类/实例？还是两套 agent、只共用 tool？

**约束回看**

| 来源   | 约束                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| §7.2   | Work tool **实现共用**；Structure 仅 chat 默认挂载                                                          |
| §7.3   | 同 Run 上 work-unit **XOR** chat（P0）                                                                      |
| Lab    | chat 产出 `LabNodeChatTurn`（text + proposals）；自研是静默推进图                                           |
| AI SDK | 同一 `ToolLoopAgent` 可用 **`prepareCall` / `prepareStep` / `activeTools` / `toolApproval`** 按次调用改行为 |

**选项**

|     | 做法                                                                    | 利                                               | 弊                       |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------ | ------------------------ |
| A   | **一个** `ToolLoopAgent` + `prepareCall({ mode, role, node… })`         | 模型/基座 instructions/遥测一处；tool 注册不复制 | `prepareCall` 变胖时难读 |
| B   | **两个** agent（`workUnitAgent` / `nodeChatAgent`）+ **共用 tool 工厂** | 模式边界清晰、难误挂 Structure                   | 两份 instructions 易漂   |
| C   | 完全两套（tool 也复制）                                                 | —                                                | **否决**（违反 SSOT）    |

**结论（锁定）**

1. **Tool 实现 SSOT（必须）**：`retrieveSources` / `webSearch`（及日后节点域 tool）只维护一份；自研与 chat **import 同一工厂**，禁止复制 `execute`。
2. **Agent 外形：选 A（默认）** — 一个 `ResearchNodeAgent`（`ToolLoopAgent`），每次调用传：

   ```ts
   // 示意
   prepareCall: ({ options }) => ({
     instructions: options.mode === 'work_unit' ? WORK_INSTR : chatInstr(options.role),
     activeTools: options.mode === 'work_unit' ? WORK_TOOLS : toolsForRole(options.role),
     toolApproval: options.mode === 'node_chat' ? STRUCTURE_APPROVAL : undefined,
     stopWhen: options.mode === 'work_unit' ? isStepCount(SMALL) : isStepCount(CHAT),
   });
   ```

   - `mode: 'work_unit'`：只 Work；无 Structure；结果由内核写节点 + `graph_patch`（可再跟一步 `Output.object` 综合，不必当 tool）。
   - `mode: 'node_chat'`：Work + Structure；Structure 走审批/提案；流式走 §7.3 POST chat。

3. **何时降级为 B**：若 `prepareCall` 分支 > ~2 屏或出现第三 mode（如「仅综合」），再拆两个 agent 类，**仍共用 tool 模块** — 不改本节语义。
4. **不共用的东西**：消息历史（自研无用户多轮 transcript；chat 有）；SSE 通道（§7.3）；调用方（scheduler vs HTTP chat）。`runtimeContext` 可共用字段形：`{ runId, nodeId, role, notebookId }`。
5. **依赖**：仍无新包；不引入第二套 agent 框架。

**验收口（写进日后 tasks 即可）**

- work_unit 路径测：挂上 Structure tool 名应被 `activeTools` 排除（或审批表为空）。
- chat 路径测：prune/fork 不可 auto-execute 成功改图。

**调研序列状态**：§7.1–7.4 已确认；§3 API **已锁 A+B+C**；按 tasks 波次 Apply。

## 8. 数据面：Revisions + Working + 进度账本（待确认）

> 你的要求：**后端都要存**，并能**及时反馈状态**；需要较好的表设计做进度「挂历/账本」。
> Lab 样板仅作交互参考；**sessionStorage 不再当权威**。

### 8.0 总览（一张图）

```text
notebooks
   └─ research_runs                 ← 当前权威头（status/graph/report/预算/活动指针）
         ├─ research_evidences      ← EV1（已有）
         ├─ research_revisions      ← 用户可见成对快照（graph+report）
         ├─ research_report_edits   ← 报告 working CoW（服务端）
         └─ research_progress_events← 追加写进度账本（挂历时间线 + SSE 同源）
```

及时反馈路径：

```text
写库（progress_events / graph / status） → broadcast Run SSE → Desk 立刻刷新
（chat 仍走独立 POST SSE，见 §7.3；chat 轮次起止也写入 progress_events）
```

### 8.1 表设计（Drizzle / SQLite）

#### (1) `research_runs` — 扩展头指针（不拆散现有 JSON graph）

在现有列上增加（迁移）：

| 列                   | 类型      | 含义                                                |
| -------------------- | --------- | --------------------------------------------------- |
| `active_revision_id` | text null | 当前内容若由某 revision 恢复/对齐，便于 UI 高亮     |
| `active_node_id`     | text null | 当前自研/焦点节点（调度器写入）                     |
| `llm_activity`       | enum null | `null \| work_unit \| node_chat` — 与 §7.3 互斥一致 |
| `report_updated_at`  | ts null   | 权威 report 最后变更                                |

`graph` / `report` / `checkpoint` / `status` 仍为**当前权威**。

#### (2) `research_revisions` — 用户版本挂历（成对快照）

| 列                             | 说明                                          |
| ------------------------------ | --------------------------------------------- |
| `id` text PK                   | `rev_…`                                       |
| `run_id` FK cascade            |                                               |
| `notebook_id` FK               | 冗余便于按本列举                              |
| `label` text                   |                                               |
| `kind`                         | `auto_complete \| user_save \| restore_point` |
| `parent_revision_id` text null | 另存/恢复链                                   |
| `graph` json                   | `{ nodes, edges }` 全量                       |
| `report` json null             | 结构化 `ResearchReport`                       |
| `searches_used` int            | 快照时预算                                    |
| `status_at_save` text          | 快照时 Run.status                             |
| `created_at`                   |                                               |

索引：`(run_id, created_at DESC)`。

#### (3) `research_report_edits` — 报告 working（服务端 CoW）

一对一（或按 run 最多一行 working）：

| 列                       | 说明                                    |
| ------------------------ | --------------------------------------- |
| `run_id` PK/FK           |                                         |
| `base_report_updated_at` | fork 时所基于的权威 `report_updated_at` |
| `report` json            | working 结构化正文（与权威同形）        |
| `updated_at`             |                                         |
| `updated_by` text null   | 预留                                    |

语义：

- **Canonical** = `research_runs.report`
- **Working** = 本表行；首编创建；保存到权威用 `PUT/PATCH …/report` 或「应用编辑」；「保存版本」打 revision 时可选择 snapshot=working 或 canonical
- 丢弃 working = DELETE 本行
- **禁止**只活在浏览器里

#### (4) `research_progress_events` — 进度账本（挂历时间线）

追加写、不改历史（除 truncate 运维）：

| 列                   | 说明                                                     |
| -------------------- | -------------------------------------------------------- |
| `id` text PK         | `pe_…`                                                   |
| `run_id` FK          |                                                          |
| `seq` integer        | Run 内单调序号（便于 gap 检测）                          |
| `at` ts              |                                                          |
| `kind`               | 见下枚举                                                 |
| `node_id` text null  | 相关节点                                                 |
| `severity` text null | 短文案（log 同源）                                       |
| `payload` json null  | 结构化细节（预算、confirmKind、revisionId、chatTurnId…） |

**`kind` 闭集（首发）**：

```text
run_queued | run_running | run_awaiting_confirm | run_completed | run_failed | run_cancelled
unit_started | unit_finished | unit_skipped_pruned | unit_aborted
node_phase          # payload: { phase }
graph_seeded | graph_patched_summary  # 可选摘要，避免整图进账本
confirm_entered | confirm_resolved
budget_tick         # searchesUsed/max
evidence_added
revision_created | revision_restored
report_canonical_updated | report_working_updated | report_working_discarded
chat_started | chat_finished | chat_aborted
```

索引：`(run_id, seq)` UNIQUE；`(run_id, at)`。

**与 SSE 的关系**：每次写入 progress_event 后，Run stream 发：

- 既有：`status` / `graph_patch` / `confirm` / `log` / `report_ready` …
- **新增**：`progress` 事件 `{ seq, kind, at, nodeId?, headline?, payload? }`

Desk 可用 `progress` 画挂历，也可用 `log` 作降级；**以 DB 账本为 SSOT**，重连后 `GET …/progress?afterSeq=` 补洞。

### 8.2 HTTP（在 §3.2 上补全）

```text
# Revisions
GET    …/research/:rid/revisions
POST   …/research/:rid/revisions              { label?, from?: 'canonical'|'working' }
GET    …/research/:rid/revisions/:revId
POST   …/research/:rid/revisions/:revId/restore

# Report CoW（服务端）
GET    …/research/:rid/report                 # { canonical, working?, viewing? }
PUT    …/research/:rid/report                 # 写权威（或 body.mode=canonical）
PUT    …/research/:rid/report/working         # 写/创建 working
DELETE …/research/:rid/report/working         # 丢弃 working

# 进度账本
GET    …/research/:rid/progress?afterSeq=&limit=
# Run SSE 增加 event: progress（及时推送；与 GET 同源）
```

### 8.3 恢复 / 保存语义（修订）

| 动作           | 行为                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 保存 revision  | 快照 **当前 graph** + 所选 report（canonical 或 working）；写 `revisions` + `progress revision_created`                                                             |
| completed 自动 | 一条 `auto_complete`（graph+canonical report）                                                                                                                      |
| 恢复 revision  | **仅终态**；覆盖 `runs.graph`+`runs.report`；清 working 或标记 stale；`active_revision_id=rev`；`graph_patch`+`progress revision_restored`；**不回滚 searchesUsed** |
| 写 working     | **仅终态**；必须落库；SSE `progress report_working_updated`（可不推全文，客户端再 GET）                                                                             |

### 8.4 为何拆表（而不是全塞 run JSON）

| 诉求         | 做法                                                    |
| ------------ | ------------------------------------------------------- |
| 及时状态     | 小行追加 `progress_events` + SSE，避免每次推整图        |
| 版本挂历     | `revisions` 独立查询/分页                               |
| 编辑不脏权威 | `report_edits` 与 `runs.report` 分离                    |
| 证据已独立   | 继续 `evidences`                                        |
| 图仍 JSON    | 首发图结构变动频繁，留在 `runs.graph`；账本只记摘要事件 |

### 8.5 仍 defer

- progress/revision 的富 diff UI
- 按 revision fork **新** Run
- 把每个 `graph_patch` 全文存进账本（体积爆）

### 8.6 已锁定（2026-07-23）

| 项                                                       | 锁定                                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| §8 表结构 + working 落库 + SSE `progress` + GET afterSeq | **确认全套**                                                                                                                            |
| 报告 working 编辑窗口                                    | **仅终态**（`completed`；`failed`/`cancelled` 若有 report 也可编；`running`/`awaiting_confirm` 只读权威）                               |
| 账本保留                                                 | Run **进行中永久追加**；进入终态后裁剪为**最近 N 条**（建议默认 **N=200**，config 可调）；revisions / report_edits **不**随账本裁剪删除 |
| 裁剪时机                                                 | 写入终态并刷完必要 progress 事件之后异步/同步 truncate（保留最大 `seq` 的 N 条）                                                        |

**Apply 含义**：C2 波次按上表实现；N 进 `config/app.yaml` research 段（如 `progressEventRetain: 200`）。
