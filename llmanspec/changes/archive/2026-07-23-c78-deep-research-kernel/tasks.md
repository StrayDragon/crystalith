## Propose

- [x] proposal + design（API 优先 · 薄前端 · 内核衔接）
- [x] delta runtime r317–r323 + scenarios
- [x] delta ui r415–r419 + scenarios
- [x] 调研 §7.1–7.4 写入 design 并确认
- [x] **§3 API 锁 A+B+C（一步到位）**
- [x] design §8 数据面锁定（working 落库 + progress retain-N）
- [x] `llman sdd validate c78-deep-research-kernel --strict --no-interactive`

## GATE（已清）

- [x] design §3 A+B+C
- [x] design §7.1–7.4
- [x] design §8

## Apply 波次 A — 内核 + DAG

- [x] shared：`ResearchNode.role` optional
- [x] server：seed 单结论 DAG；fork approve→merge；prune 保护 role 优先
- [x] server：串行 kernel（CP1 + Abort + discard-if-pruned）；替换 stub `runLoop`
- [x] Desk：薄客户端 + role 优先渲染（r415/r416）
- [x] 测：seed / fork-merge / prune+role / cancel abort

## Apply 波次 B — PATCH

- [x] shared：`ResearchNodePatchBody` + OpenAPI
- [x] server+router：`PATCH …/nodes/:id`（live；拒 pruned/保护）
- [x] Desk/Lab：改 query/状态走 PATCH
- [x] 测：patch 成功与拒绝路径

## Apply 波次 C1 — 节点 chat

- [x] shared：chat body + proposal/事件 schema
- [x] server：`POST …/nodes/:id/chat` SSE；`ResearchNodeAgent(mode=node_chat)`；与 work-unit 互斥
- [x] Desk：chat UI → SSE；accept→命令口（r417）
- [x] 测：chat 不进 Run stream；提案不自动 prune

## Apply 波次 C2 — revisions + report CoW + 进度账本

- [x] DB migrate：`research_revisions` · `research_report_edits` · `research_progress_events` + runs 指针列
- [x] shared：revision / report-edit / progress schema；config `progressEventRetain`（默认 200）
- [x] server：revisions + report working + progress 写入/SSE/GET afterSeq；终态 truncate N
- [x] Desk：版本挂历 / 报告 CoW / 进度时间线（r419）
- [x] 测：落库、补洞、恢复、working、truncate

## Apply 波次 C3 — 画布机制

- [x] Desk：迁入 Lab 画布偏好（方向/算法/小地图）（r418）
- [x] 测：切换偏好不打 graph 命令口

## 收尾

- [x] `just qa`（或约定子集全绿）
- [x] verify → archive
