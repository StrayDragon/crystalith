# Design: c104 confirm-gated re-expand / re-decompose

## 1. 目标

| 做                                                          | 不做               |
| ----------------------------------------------------------- | ------------------ |
| 显式 `request-reexpand` → confirm → 再拆/扩支               | 自动二次 decompose |
| 复用 `planTopicDecomposition` + `applyDecomposePlanToGraph` | C2/C3              |
| Lab 最小确认条（approve/skip）                              | 逐步计划审批 UI    |

## 2. 命令口

```text
POST …/research/:rid/request-reexpand
  body: { hint?: string, focusNodeId?: string }
  允许 status: awaiting_confirm | running（running 时协作 pause 进 confirm）
  → status=awaiting_confirm, confirmKind=reexpand
  → SSE status + confirm

POST …/confirm
  reexpand + action=approve_branch（复用名）或 approve_reexpand / skip_reexpand
  → approve: 跑 planner（hint/focus 约束）→ graph_patch → drain 新支路 → 既有 M1/synthesize
  → skip: 清除 confirm → 继续既有收束（synthesize 或 resume）
```

**推荐动作枚举（锁定进 apply）：**

- `confirmKind` 增 `reexpand`
- `action` 增 `approve_reexpand` | `skip_reexpand`（与 expand_branch 的 approve/skip 对称，避免语义混用）

## 3. Planner 约束

- `occupiedNodes` / `maxNodes` 裁剪同 c93
- `focusNodeId`：若提供，自该 research/question 发出 decompose/refine 边；否则自 question
- 失败/空 plan：progress `unit_aborted`，MUST NOT 伪造支路；可回到 running 或 finish

## 4. 红线

1. 无用户动作 → 内核不得二次 decompose
2. LLM 不直接 mutate 图
3. 报告 token 不进 Run SSE

## 5. Lab UI（最小）

- 顶栏/次操作：「继续深挖 / 再扩展」→ `request-reexpand`
- `confirmKind=reexpand` 时展示批准/跳过（testid 对齐现有 confirm 控件或最小增补）

## 6. 测试

- unit：request → awaiting_confirm+reexpand；approve 增节点+merge；skip 不增；非法态 409
- 无自动二次：跑完一波 stub 后未 request 不得再 decompose
- Vitest：触发 request + confirm 动作映射
