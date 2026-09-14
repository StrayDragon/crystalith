---
depends_on: []
---

# 节点 chat 合约诚实化：禁止静默 stub 降级 + 接线 chat 事件契约

> 2026-09 阶段性 QA 产物。spec 归属已核实：节点 chat 的**互斥**已有 MUST 条款（deep-research-runtime「Node chat SSE proposals only」），但**失败语义**与**事件契约接线**均无条款/未落地——这两点需要 specs 修正或合约落地，故走 SDD。

## Why

**1. 模型失败时，用户会收到冒充 AI 的模板回复（诚实性缺陷，用户可感知）。**

`apps/server/src/features/research/node-chat.ts:264-289`：agent 抛错被 catch 后静默降级到 `stubNodeChatTurn`（:34-117，正则关键词模板 + 假提案），以正常 `chunk`/`proposal` 事件流式发给用户；聊天流内无任何降级标记，仅 server 日志 warn 与 progress 事件的 `via:'stub'`。模型配置错误 / 网关宕机时，用户拿到看似正常的回答并可能据此做出 fork/剪枝决策。

这与仓库自身既定的反伪造原则冲突：

- `run-loop.ts:373` 注释明文「MUST NOT pragmatic fake-hit fallback」（work_unit 侧）；
- `deep-research-runtime.feature` r114/r146：规划失败 MUST NOT 伪造多支路拓扑；
- `deep-research-ui.feature` r66：默认生产路径 MUST NOT 伪造图/状态。

唯独 node_chat 正文这条用户直接消费的路径存在静默伪造，属于原则的执行漏洞。

**2. node chat 的 SSE 事件契约是「文档型 SSOT」假象。**

`packages/shared/src/schemas/research.ts:688-715` 已定义 `ResearchNodeChat{Chunk,Done,Error,Log,Proposal}EventSchema` 与 `ResearchNodeChatStreamEventSchema`，但**全仓库零引用**：chat 路由（`research/router.ts:451`）不挂 response，`node-chat.ts:170` 用 `emit(event: string, data: unknown)` 裸发。shared 声称的契约既无编译期约束也无运行时校验，字段漂移无门禁可拦。

**3. 现状并非不能修：e2e 已有显式开关。**

E2E 全链路走 `CL_RESEARCH_E2E_STUB=1`（`e2e/playwright.config.ts:71`、`e2e/mock-openai-gateway.ts`），stub 本就该只活在这个显式非生产开关后面，而不是作为生产降级路径。

## What Changes

- **行为（需 spec 修正）**：模型调用失败/异常 MUST 经 chat SSE `error` 事件显式终结对话（含 errorCode/message），MUST NOT 以 stub/模板内容冒充模型回复；`stubNodeChatTurn` MUST 仅在 `CL_RESEARCH_E2E_STUB=1` 下可达；progress ledger MUST 记录 chat 失败事件。
- **契约（合规任务，无需新条款）**：将 shared 的 `ResearchNodeChat*EventSchema` 真正接线——chat SSE 的 emit 出口以 shared schema 收窄类型，dev/test 下 safeParse 断言；使「chunk、proposal、done、error」事件契约从声明变为受控。
- **不动**：chat 与 work-unit 互斥（r98 已有 MUST，属实现欠账，另走直接修正批次，见根目录 `_HANDOFF.md` W3）；fixture/（Fake）文案泄漏（web 侧小修，已随直接批次 W1 完成）。

## 证据快照（2026-09-14）

| 证据                                                       | 位置                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| agent 失败 → `usedAgent=false` → stub 流式输出，无降级标记 | `apps/server/src/features/research/node-chat.ts:264-289`              |
| stub 模板正文 + 假提案生成器                               | `apps/server/src/features/research/node-chat.ts:34-117`               |
| chat 路由未挂 response、emit 裸发 `unknown`                | `apps/server/src/features/research/router.ts:451`、`node-chat.ts:170` |
| shared 事件 schema 零引用                                  | `packages/shared/src/schemas/research.ts:688-715`                     |
| e2e 显式 stub 开关（本变更后仍可用）                       | `e2e/playwright.config.ts:71`                                         |

### 证据刷新方法（apply 开头再跑一次）

```bash
grep -n 'usedAgent' apps/server/src/features/research/node-chat.ts
grep -rn 'ResearchNodeChatStreamEventSchema' apps/ packages/ --include='*.ts' | grep -v test
```

若接线已发生（第二行有 apps/ 命中）→ 契约部分缩小为补测试；若 stub 已被移除 → 本变更降级关闭。

## 非目标

- 不改 chat 互斥机制（实现欠账归直接批次 W3）。
- 不重设计 chat UI（web 侧消费 `error` 事件的展示若缺失，随本变更补最小展示）。
- 不动 e2e stub 体系本身（`features/research/e2e-stub.ts` 的 env 门控维持现状）。
