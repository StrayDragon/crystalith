# Design: c108 Research budget commitment

## 1. 目标

| 做                                         | 不做                      |
| ------------------------------------------ | ------------------------- |
| 档内承诺跑完；仅真触顶 + 主动加购打断      | 波次剩余停 / max-1 逼近停 |
| continue / 加购 = 抬 maxSearches（公式 K） | continue 不抬 maxNodes    |
| L1 20/50/100 · 24/60/120；默认 medium      | 读页钱包（c107）          |
| 每节点搜索软上限均分剩余                   | 费用/token 计费 SSOT      |
| 触顶 finish_report 诚实「部分完成」        | 恢复逐步计划审批          |

## 2. 状态机（budget）

```text
running → (searchesUsed >= maxSearches AND still need web search)
       → awaiting_confirm confirmKind=budget
            continue → maxSearches += K; status=running; resume drain/loop
            finish_report → synthesize（报告含预算用尽·未覆盖节点）

running → user/agent add-budget → maxSearches += K（不经 awaiting_confirm 亦可）
```

删除：

- 波次结束 `searchesUsed > 0 && < maxSearches` → enterConfirm(budget)
- question 路径 `approaching = searchesUsed >= max-1` → enterConfirm(budget)
- confirm continue「只再跑一轮 question 然后强制 synthesize」的假继续

## 3. 加购公式

```text
K = clamp(ceil(run.maxSearches * addOnRatio), minK, maxK)
# defaults: addOnRatio=0.25, minK=5, maxK=50
```

- 基于**当前** `run.maxSearches`（连点会抬高基数）
- 只改 `maxSearches`；`maxNodes` / `maxPageFetches` 不变（pages 属 c107；扩图走 reexpand）

## 4. 命令口

- 扩展现有 `POST …/confirm`：`action=continue` 在 budget 时执行加购并 **resume**（非立刻结案）
- 新增（或等价）`POST …/add-budget`：running / awaiting_confirm(budget) 可调用；同一 K 语义
- Agent：`propose_confirm_continue` / 新 propose_add_budget → 用户接受后走同一口

## 5. 软上限（搜索）

每 work-unit 开始：

```text
searchSoft = max(1, ceil(remainingSearches / remainingLiveResearchNodes))
```

- 节点内 `webSearch` 成功次数不得超过 searchSoft
- Agent 指令写入剩余全局与 soft
- 全局硬顶仍 `maxSearches`

## 6. L1 表

| depth   | maxSearches | maxNodes |
| ------- | ----------- | -------- |
| shallow | 20          | 24       |
| medium  | 50          | 60       |
| deep    | 100         | 120      |

创建时 `maxPageFetches` 仍按 c107 公式从 maxSearches 派生。

## 7. 部分完成报告

- synthesize prompt：若存在 missing/未检索 research 节点，MUST 在报告中说明预算用尽与未覆盖主题
- Lab UI：完成态展示「预算用尽·部分完成」类提示（有未覆盖时）

## 8. Config

```yaml
research:
  addOnRatio: 0.25
  addOnMinK: 5
  addOnMaxK: 50
```

## 9. Spec

- MODIFIED r305（数字）、r306（确认时机 + continue=加购）、r327（去掉「波次必 budget confirm」若冲突）
- ADDED：加购命令、软上限、主动加购、部分完成诚实
- UI：r449 文案；新增常驻加购；r447 浅档映射数字更新

## 10. 测试 seams（已确认）

1. DEPTH_BUDGETS 与默认 medium
2. confirm/add-budget 公式与不抬 maxNodes
3. run-loop 确认时机 + 软上限
4. 部分完成报告
5. Lab UI + research 测试回归
