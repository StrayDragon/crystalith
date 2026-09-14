---
depends_on: []
---

# Research Lab SSE 断线韧性：有界重连 + 可见中断态（含 server 终态等待去轮询）

> 2026-09 阶段性 QA 产物。spec 归属已核实：deep-research-ui 现有条款只约定了 SSE 正常到达后的合并/刷新语义（r129-130）与队列轮询（r17），**未约定 SSE 意外断开后的客户端行为**——需要新增 MUST 条款，故走 SDD。服务端 run-sse 的终态等待去轮询是实现债，随本变更顺带（同生命周期面）。

## Why

**1. SSE 断线后，运行中任务在 UI 上静默冻结（产品核心长任务链路最贵的失败模式）。**

`apps/web/src/features/research-lab/useEdenLabController.ts:316-328`：`startStream` 的 `finally`
只做一次 `getResearchRun` 对账；若 status 仍为 running，则**不再重订阅、不提示**。
`apps/web/src/api/stream.ts:101-160` 的流生成器无任何重试语义。深度研究一次跑几十分钟，
网络闪断 / 服务器重启后，用户面对一个永久停格的「进行中」面板，只能碰运气刷新页面。

服务端有 DB checkpoint 兜底（Run 状态不丢），缺的纯粹是客户端恢复语义——这正是
spec 该管而没管的部分。

**2. server 侧 run SSE 的终态等待是每订阅者 100ms 轮询 DB。**

`apps/server/src/features/research/run-sse.ts:68-88`：`createResearchSseResponse` 用
`setTimeout(tick, 100)` 死循环查 `researchRuns` 表等终态，每连接一份（多开页面 × 长跑 Run =
恒定 10 QPS 纯轮询）。终态广播通道其实已存在（`emitStatus` → `broadcast(runId,'status')`），
等待应改为订阅广播 + 超时兜底。本变更顺手修掉，避免重连语义上线后连接数上升放大轮询。

## What Changes

- **行为（需 spec 修正，落在 deep-research-ui）**：Run SSE 意外断开时客户端 MUST 立即对账
  GET ResearchRun；Run 非终态 MUST 以有界退避自动重订阅；重连期间 MUST 展示可见的
  「连接中断/重连中」状态；超过重试上限 MUST 呈现明确错误与手动重试入口；终态 MUST 停止重试；
  MUST NOT 在重连期间伪造进度（与 r66 反伪造条款衔接）。
- **实现（无合约变化）**：`run-sse.ts` 终态等待从 100ms 轮询改为订阅既有 status 广播
  （promise resolve + 超时兜底）；客户端 `stream.ts` 增加可复用的重订阅 wrapper 或在
  controller 层实现循环（design §3 二选一，倾向前者）。
- **不动**：wire 协议零变化（无新事件、无新端点——重连就是重新 GET 既有 SSE 端点 +
  `progress` gap-fill 既有机制）；notebook 级 list SSE 仍被 r17 禁止，不引入。

## 证据快照（2026-09-14）

| 证据                                              | 位置                                                    |
| ------------------------------------------------- | ------------------------------------------------------- |
| SSE 死亡后仅一次对账，running 即不再恢复、无提示  | `apps/web/src/features/research-lab/useEdenLabController.ts:316-328` |
| 流生成器无重试语义                                | `apps/web/src/api/stream.ts:101-160`                    |
| 每订阅者 100ms 轮询 researchRuns 等终态           | `apps/server/src/features/research/run-sse.ts:68-88`    |
| 终态广播已存在（可复用为 resolve 信号）           | `run-sse.ts` 的 `emitStatus` → `broadcast(runId,'status')` |
| progress gap-fill 既有机制（重连补账本用）        | `deep-research-ui.feature:170`（progress ledger 条款）  |

### 证据刷新方法（apply 开头再跑一次）

```bash
sed -n '310,335p' apps/web/src/features/research-lab/useEdenLabController.ts
grep -n 'setTimeout(tick' apps/server/src/features/research/run-sse.ts
```

若 controller 已有重连循环 → 行为部分缩小为补 spec（把既成事实条款化）+ 测试。

## 非目标

- 不做跨刷新的任务恢复（页面刷新后由既有「打开抽屉 refresh + 对账」覆盖）。
- 不新增心跳/保活协议（服务端心跳 `node-chat.ts:187` 已有先例但本变更不扩展到 run stream；
  若重连实现中发现 Nginx 类代理空闲断连是主因，在 design 附录记录，另行处理）。
- 不改 ResearchTasksDrawer 轮询策略（r17 已约定，保持）。
