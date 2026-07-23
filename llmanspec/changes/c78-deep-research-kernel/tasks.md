## Propose

- [x] proposal + design（API 优先 · 薄前端 · 内核衔接）
- [x] delta runtime r317–r323 + scenarios
- [x] delta ui r415–r419 + scenarios
- [x] 调研 §7.1–7.4 写入 design 并确认
- [x] **§3 API 锁 A+B+C（一步到位）**
- [x] `llman sdd validate c78-deep-research-kernel --strict --no-interactive`

## GATE（已清）

- [x] design §3 A+B+C
- [x] design §7.1–7.4

## Apply 波次（实施时改勾选；此处用编号以免 propose 期 strict 误报）

### A — 内核 + DAG

1. shared：`ResearchNode.role` optional
2. server：seed 单结论 DAG；fork approve→merge；prune 保护 role 优先
3. server：串行 kernel（CP1 + Abort + discard-if-pruned）；替换 stub `runLoop`
4. Desk：薄客户端 + role 优先渲染（r415/r416）
5. 测：seed / fork-merge / prune+role / cancel abort

### B — PATCH

1. shared：`ResearchNodePatchBody` + OpenAPI
2. server+router：`PATCH …/nodes/:id`（live；拒 pruned/保护）
3. Desk/Lab：改 query/状态走 PATCH
4. 测：patch 成功与拒绝路径

### C1 — 节点 chat

1. shared：chat body + proposal/事件 schema
2. server：`POST …/nodes/:id/chat` SSE；`ResearchNodeAgent(mode=node_chat)`；与 work-unit 互斥
3. Desk：chat UI → SSE；accept→命令口（r417）
4. 测：chat 不进 Run stream；提案不自动 prune

### C2 — revisions + report CoW + 进度账本（design §8 **已确认**：全套 + 终态裁剪 N）

1. DB migrate：`research_revisions` · `research_report_edits` · `research_progress_events` + runs 指针列
2. shared：revision / report-edit / progress 事件 schema；config `progressEventRetain`（默认 200）
3. server：revisions CRUD+restore；report canonical/working（仅终态写 working）；progress 写入 + SSE `progress` + GET afterSeq；终态后 truncate 最近 N
4. Desk：版本挂历 / 报告 CoW / 进度时间线（r419）
5. 测：落库、补洞、恢复、working 丢弃、truncate

### C3 — 画布机制

1. Desk：迁入 Lab 画布偏好（方向/算法/小地图）（r418）
2. 测：切换偏好不打 graph 命令口

### 收尾

1. `just qa`（或约定子集全绿）
2. verify → archive

## 仍不做

- 报告/chat token 进入 Run stream（r311）
- 整图 PUT / 静默改图 tool
