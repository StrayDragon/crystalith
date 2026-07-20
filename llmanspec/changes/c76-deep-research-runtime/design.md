## Context

- **后端 wire SSOT = 本文**（原 runtime-spec / PRD 后端决策已并入）。
- FE：`c77-deep-research-ui`。
- 现状：`research/router.ts` 501 stub；c75 顶栏已归档。
- 约束：AI SDK v7；禁 LangGraph/Mastra；`searchWeb` 单实现。

## Goals / Non-Goals

**Goals**：后端 ResearchRun full 路径（proposal What Changes 1–9）+ Zod/OpenAPI/Eden + 单测。

**Non-Goals**：FE xyflow/Desk/报告交互（占位）；旧 HITL 全家桶；整本语义搜索；完成时自动写笔记；P2「从节点 fork 新 Run」。

## Decisions（全表）

| 主题        | 选择                                              | ID     |
| ----------- | ------------------------------------------------- | ------ |
| SSOT        | ResearchRun                                       | B      |
| 不自动笔记  | 显式 convert                                      | B1     |
| 创建边界    | 双开关+台内选源                                   | H1′    |
| 深度        | 浅/中/深数字                                      | L1     |
| 状态        | R2a 六态                                          | R2a    |
| SSE         | status/graph_patch/confirm/report_ready/log/error | R3b    |
| graph_patch | 增量 upsert+remove                                | D1     |
| 节点结论    | clear/partial/missing/pending/pruned              | R4     |
| 边          | 闭集 R5                                           | R5     |
| 报告        | R6a + Citation map                                | R6/K1  |
| 转化目标    | report\|node\|evidence                            | R7     |
| Evidence    | Run 内证据表                                      | EV1    |
| 取消        | 协作+checkpoint                                   | A1     |
| Checkpoint  | 每节点+M1前                                       | CP1    |
| 确认        | 仅两类硬停                                        | M1     |
| 剪枝/fork   | running/awaiting_confirm                          | U2     |
| 错误码      | 通用+2 专用                                       | ERR-G1 |
| FE          | 本 change 占位                                    | —      |

## FE 已锁、本 change 不实现

U1 图=思路；E1′ 节点转化淡化；F1-CTA；UI-C1 CitationsControl；C1 语义色。见 `c77-deep-research-ui`。

## Risks

- 预算/abort 不准 → M1 误触：单测覆盖计数。
- convert 未 embed → RAG 检不到：验收必测。
- 禁止复活旧 HITL 字段名误导客户端。

## Open

**无。** 后端合约以本文为准；FE 实现另开 change。

---

## Runtime wire（定稿）

### 0. HTTP 面

```text
POST   /v2/notebooks/:nid/research
GET    /v2/notebooks/:nid/research
GET    /v2/notebooks/:nid/research/:rid
GET    /v2/notebooks/:nid/research/:rid/stream
POST   /v2/notebooks/:nid/research/:rid/confirm
POST   /v2/notebooks/:nid/research/:rid/cancel
POST   /v2/notebooks/:nid/research/:rid/nodes/:nodeId/prune
POST   /v2/notebooks/:nid/research/:rid/nodes/:nodeId/fork
POST   /v2/notebooks/:nid/research/:rid/convert-to-note
POST   /v2/notebooks/:nid/research/:rid/convert-to-source
```

### 1. Create body（H1′）

```ts
{
  topic: string; // 必填
  useNotebookSources?: boolean; // 默认 true
  sourceIds?: number[]; // 仅深研台选择器；与 workspace 勾选无关
  allowWeb?: boolean; // 默认 true
  depth?: 'shallow' | 'medium' | 'deep'; // 默认 'medium' → L1
}
```

**校验**

- `useNotebookSources || allowWeb` 至少其一为 true，否则 `INVALID_REQUEST`。
- `useNotebookSources === true` 且 `sourceIds` 为空/缺省 → `INVALID_REQUEST`。
- `useNotebookSources === false` 时忽略 `sourceIds`。

成功：返回 Run（至少 `id` + `status: 'queued'`）；**MUST NOT** 再以 501 作为成功路径。

### 2. Run status（R2a）

| status             | 含义              |
| ------------------ | ----------------- |
| `queued`           | 已创建、尚未开跑  |
| `running`          | 执行中            |
| `awaiting_confirm` | M1 硬停待用户确认 |
| `completed`        | 有终稿            |
| `failed`           | 不可恢复失败      |
| `cancelled`        | 用户取消          |

### 3. Stream events（R3b）

GET `…/research/:rid/stream`（SSE，对齐 c70）。事件：

| event          | data 要点                                         |
| -------------- | ------------------------------------------------- |
| `status`       | `{ status, reason? }`                             |
| `graph_patch`  | 见 §11                                            |
| `confirm`      | `{ kind: 'budget' \| 'expand_branch', …选项 }`    |
| `report_ready` | `{ runId }`（亦可仅靠 `status=completed`）        |
| `log`          | `{ message, at? }`                                |
| `error`        | `{ errorCode, message }`（与 ErrorEnvelope 对齐） |

**不做**：报告正文逐 token 流式。

### 4. Graph interaction（U2）

| 动作  | 时机                                   | 语义                                              |
| ----- | -------------------------------------- | ------------------------------------------------- |
| prune | `running` \| `awaiting_confirm`        | 子树 → `pruned`；可引用已产出证据；不再扩展该支路 |
| fork  | 同上                                   | body `{ hint?: string }`；与 M1 扩支路同能力面    |
| 只读  | `completed` \| `failed` \| `cancelled` | 可浏览；改方向 → 新 Run（P2：从节点 fork 新 Run） |

非法状态调用 → `RESEARCH_INVALID_STATE`。

### 5. Node / Edge 最小字段

```ts
type ConclusionStatus = 'clear' | 'partial' | 'missing' | 'pending' | 'pruned';
type NodePhase = 'idle' | 'retrieving' | 'synthesizing';

type Node = {
  id: string;
  title: string;
  query?: string;
  summary?: string;
  conclusionStatus: ConclusionStatus;
  phase?: NodePhase; // 默认 idle
  evidenceIds?: string[]; // → EV1
};

type EdgeKind =
  'decompose' | 'expand' | 'focus' | 'filter' | 'compare' | 'refine' | 'support' | 'fork' | 'merge';

type Edge = {
  id: string;
  source: string; // node id
  target: string;
  kind: EdgeKind;
  labelNote?: string;
};
```

配色（C1）属 FE；wire 只发 `conclusionStatus` / `kind`。

### 6. Edge kinds（R5）

闭集：上表 `EdgeKind`。MUST NOT 以自由中文为唯一边类型。

### 7. Report shape（R6 + K1）

```ts
{
  title: string;
  sections: Array<{
    id: string;
    heading: string;
    blocks: Array<
      | { type: 'paragraph'; text: string; citeIds: string[] }
      | { type: 'bullets'; items: Array<{ text: string; citeIds: string[] }> }
    >;
  }>;
  citations: Record<string, Citation>; // 全局 map；Citation = shared schema
}
```

`convertToNote`：按出现序 → GFM `[^n]` + 脚注附录；OutputType = `PARAGRAPH`（I1）。

### 8. Convert（R7）

```ts
type ArtifactRef =
  { kind: 'report' } | { kind: 'node'; nodeId: string } | { kind: 'evidence'; evidenceId: string };

// POST …/convert-to-note | …/convert-to-source
{
  artifact: ArtifactRef;
}
```

- Note：PARAGRAPH + K1；MUST NOT 完成时自动写笔记（B1）。
- Source：ingest + embed，对话检索可命中。

### 9. Cancel（A1）

`POST …/cancel`：协作取消；尽量落盘 checkpoint；→ `cancelled`；SSE `status`（+ 可选 `log`）。

### 10. Checkpoint（CP1）

- 每完成一个图节点写 checkpoint。
- 进入 `awaiting_confirm`（M1）前强制 checkpoint。

### 11. graph_patch（D1）

```ts
{
  nodes?: Node[];
  edges?: Edge[];
  removeNodeIds?: string[];
  removeEdgeIds?: string[];
}
```

### 12. Evidence store（EV1）

```ts
type Evidence = {
  id: string;
  kind: 'web' | 'chunk';
  title: string;
  snippet?: string;
  url?: string; // web
  sourceId?: number; // chunk / notebook source
  chunkId?: string;
  collectedAtNodeId?: string;
};
```

持久化：独立表或 Run JSON 等价物均可；对外 id 稳定、可 convert。

### 13. Confirm（M1）

```ts
// POST …/confirm
{
  action: 'continue' | 'finish_report' | 'approve_branch' | 'skip_branch';
  branchNodeId?: string; // approve_branch / skip_branch 时必填
}
```

仅两类硬停：预算将尽 / 扩支路。非 `awaiting_confirm` → `RESEARCH_INVALID_STATE`。

### 14. Depth（L1）

| depth   | maxSearches | maxNodes |
| ------- | ----------- | -------- |
| shallow | 8           | 12       |
| medium  | 20          | 30       |
| deep    | 40          | 60       |

默认 `medium`。逼近外网预算 → M1 `budget`；强行超预算拒绝 → `RESEARCH_BUDGET`。

### 15. Errors（ERR-G1）

复用 `AppHttpError` + 既有 `ErrorCode`（`INVALID_REQUEST` / `NOT_FOUND` / `CONFLICT` / `MODEL_*` / `INTERNAL_ERROR` 等）。

**仅新增：**

| code                     | HTTP | 用途                    |
| ------------------------ | ---- | ----------------------- |
| `RESEARCH_INVALID_STATE` | 409  | 状态机不允许该动作      |
| `RESEARCH_BUDGET`        | 409  | 外网/节点预算不可再推进 |

MUST NOT 另建一整套 research-only error 命名空间。

### 16. Tools（实现约束）

- 外网检索 MUST 复用 `searchWeb`；MUST NOT 在 research 内复制 SearXNG fetch。
- 禁 LangGraph / Mastra 等外部编排（NG4）。
