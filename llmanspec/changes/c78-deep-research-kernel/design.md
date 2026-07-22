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

| 项                    | 锁定                                  |
| --------------------- | ------------------------------------- |
| 编排                  | CP1 + Abort；P0 串行；同 Run LLM 互斥 |
| role                  | optional + 兼容                       |
| conclusion            | 开跑即 seed                           |
| fork                  | fork/expand + merge→conclusion        |
| Agent                 | 单 ToolLoopAgent + prepareCall(mode)  |
| API                   | **A+B+C 全做**                        |
| 报告 token→Run stream | **不做**                              |

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

## 8. C2 Revisions 形状草案（待确认 · 对齐 Lab）

> Lab 样板：`labRevisions.ts`（graph+report 成对快照）+ `reportCow.ts`（编辑 CoW）。生产权威迁服务端。

### 8.1 与 checkpoint 的区别

|        | **checkpoint**（已有）                          | **revision**（C2 新增）                                       |
| ------ | ----------------------------------------------- | ------------------------------------------------------------- |
| 谁可见 | 内部 / 运维恢复                                 | **用户**（Desk 列表）                                         |
| 何时写 | CP1：节点完成、进 confirm 前、cancel            | 用户「保存版本」；可选 `completed` 时自动一条 `auto_complete` |
| 内容   | 轻量：`at/status/searchesUsed/nodeCount/reason` | **成对全量**：graph + 权威 report                             |
| 恢复   | 进程级尽力（P0 不保证崩溃续跑）                 | 用户显式「恢复此版本」                                        |

### 8.2 存储字段（建议 wire）

```ts
ResearchRevision {
  id: string;              // 稳定 id（如 rev_…）
  runId: number;
  label: string;           // 展示名
  kind: 'auto_complete' | 'user_save';
  createdAt: string;       // ISO
  parentRevisionId: string | null;  // 从哪版另存；首版 null
  // 快照体：
  graph: { nodes: ResearchNode[]; edges: ResearchEdge[] };
  report: ResearchReport | null;    // 结构化 SSOT（非仅 markdown）
  // 可选元数据（便于 UI，非编排态）：
  topic?: string;          // 冗余自 run.topic
  searchesUsed?: number;
  statusAtSave?: ResearchRunStatus;
}
```

**不入库（Lab-only）**：`phase` 回放、`mutations`、`forkSeq`、`forceStatus`、scenarioId。

**报告编辑 CoW**：

- **Canonical** = 当前 Run 上的 `report`（服务端）。
- **Working**：Desk 本地编辑缓冲（可 sessionStorage）；**未**单独占 revision。
- 「保存版本」→ `POST …/revisions`：把 **当前 graph +（working 若已写回则先 PATCH/保存 report，否则用 canonical）** 打成 `user_save`。
- 首发可不做独立 `PATCH …/report`：保存版本时可带可选 `report` 覆盖体，或要求先「应用编辑到 Run」再快照——**推荐：创建 revision 时允许 body 带 `report?`；缺省用当前 Run.report**。

### 8.3 HTTP（建议）

```text
GET    …/research/:rid/revisions
POST   …/research/:rid/revisions          body: { label?: string; report?: ResearchReport }
GET    …/research/:rid/revisions/:revId
POST   …/research/:rid/revisions/:revId/restore   # 无 body 或 { confirm: true }
```

列表项可瘦身（无完整 graph/report）；详情/恢复用全量。

### 8.4 恢复语义（建议锁定）

1. **覆盖当前权威**：把该 revision 的 `graph` + `report` 写回 Run；发 `graph_patch`（全量 upsert 或先清再 upsert）+ 若有 report 则等价于刷新（可 `report_ready` 或客户端 GET）。
2. **历史保留**：不删其它 revision；可写 `parentRevisionId` 链表示「从哪恢复后再另存」。
3. **何时允许**
   - **推荐**：`completed | failed | cancelled` 可恢复（只读 Run 上改「当前展示/导出」内容）；
   - `running | awaiting_confirm`：**拒绝**（`RESEARCH_INVALID_STATE`），避免与内核抢图。
4. **不自动开新 Run**；不改 `topic`/预算计数除非快照里带了且产品要——**首发恢复不回滚 `searchesUsed`**。
5. 恢复后 `active` 对用户 = 当前 Run 内容；可选 `run.activeRevisionId` 指针（方便 UI 高亮）；无指针时 UI 用「是否与某 rev 内容相等」弱提示即可。

### 8.5 自动快照

- Run 首次进入 `completed` 且有 report → 自动插入一条 `kind: auto_complete`（label 如「完成时报告」），避免用户无版本可回。
- 不在每个 CP1 自动建 revision（避免爆炸）。

### 8.6 仍 defer

- revision 之间 diff UI
- 按 revision fork **新** ResearchRun
- 把 Lab `reportCow` working 提升为服务端独立资源（首发本地 working 足够）
