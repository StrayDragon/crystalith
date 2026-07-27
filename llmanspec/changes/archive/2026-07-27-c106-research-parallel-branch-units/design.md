# Design: c106 parallel branch work-units

## 1. 目标

| 做                                                   | 不做                           |
| ---------------------------------------------------- | ------------------------------ |
| drain 同时推进最多 N 个 live research 节点（默认 2） | 同 Run 多 LLM 真并行           |
| 每 Run 一个 LLM 串行队列（短综合 / tool loop）       | 改 HTTP 命令口                 |
| `persistGraph` / evidence 写回 per-Run 互斥锁        | C2 fork / C1 reexpand 行为变更 |
| cancel/prune 仍 abort；chat↔work-unit 互斥保留       |                                |

## 2. 调度

```text
drainResearchWorkUnits:
  while pending:
    take up to N = research.parallelBranchUnits (clamp 1..8, default 2)
    Promise.allSettled(runNodeWorkUnit for each)
    // each unit: IO (search) may overlap; LLM awaits runLlmQueue(runId)
    writeBack under runWriteLock(runId)
```

- `N=1` → 行为与今日串行等价（回归安全阀）
- 预算耗尽：仍 per-node skip+missing，不整波硬停
- 取 pending 时重读图；已 pruned / 不需 work 的跳过

## 3. LLM 队列

- `withRunLlmLock(runId, fn)`：同 Run 互斥；不同 Run 不互斥
- `runNodeWorkUnit` 内所有 `generateText` / structured LLM 走该锁
- 节点 chat 已有互斥：保持；work-unit 持锁期间 chat 仍拒

## 4. 写回锁

- `withRunWriteLock(runId, fn)` 包住 `persistGraph` / evidence insert / `writeBackNodeWork`
- 避免并行 patch 丢更新

## 5. Config

```yaml
research:
  parallelBranchUnits: 2 # 1 = serial
```

Zod：`ResearchSettingsSchema.parallelBranchUnits` int 1..8 default 2；更新 `app.schema.gen.json` 门禁。

## 6. Spec

- 修订 r327：调度 MAY 并行至 N；LLM MUST 同 Run 串行
- 新增 r336 明确队列与写锁（若 r327 修订已足够可只扩 r327 + scenarios）

## 7. 测试

- unit：N=2 下两个节点都完成；merge 边保留
- LLM 队列：重叠调用不并发执行（mock delay 断言）
- N=1 回归现有 drain 测试
- cancel 中止进行中的并行单元
