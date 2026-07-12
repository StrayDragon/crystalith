# c37 Design — Research agent v1 行为对齐

## v1 行为契约 (SSOT: `backend/py/.../research/api.py` + `graph.py`)

### 控制端点状态机

v1 research 是显式状态机，每个控制端点都：记录 step → 转移状态 → 启后台 resume task。

```
_infer_resume_state(research) → (status, iteration):
  检查最后一个 step 的 type + action:
    - PLAN_GENERATED / SEARCH_RESULTS / ANALYSIS_COMPLETED → 推断对应 status
    - USER_INPUT + action=approve → WAITING_USER→SEARCHING
    - USER_INPUT + action=modify → 回 PLANNING
    - USER_INPUT + action=skip → PLANNING (iteration 已推进)
    - USER_INPUT + action=cancel → 拒绝 resume
  未找到有效 step → null (无法推断)
```

### 各端点 v1 行为

| 端点               | v1 行为 (api.py)                                                            | v2 当前                          |
| :----------------- | :-------------------------------------------------------------------------- | :------------------------------- |
| approve (:483-534) | 记 user_input(approve) step → 设 SEARCHING → 启 resume task                 | 只翻 status，无 step，无 resume  |
| modify (:537-577)  | 记 user_input(modify) step + 存新 plan → 设 PLANNING → 启 resume            | 存 outputData 不存 inputData     |
| skip (:591-647)    | 记 user_input(skip) step → iteration++ (或 complete) → 设 PLANNING → resume | 设 searching，无 step 无推进     |
| finish (:650-687)  | 记 user_input(finish) step → 设 COMPLETED → graph 跑 GenerateReport         | 设 completed，无报告             |
| cancel (:690-731)  | 记 user_input(cancel) step → 设 CANCELLED → release lock                    | 设 cancelled，无 step 无 release |
| resume (:732-795)  | 调 _infer_resume_state → 设推断的 status/iteration → 启 resume task         | 强制 planning 重跑               |
| delete (:440-463)  | if running → cancel → delete                                                | 不存在                           |

### lock 管理 (api.py:65-164)

```python
acquire_lock(): 设 locked_until = now + LOCK_TIMEOUT (5min)
extend_lock(): locked_until = now + LOCK_TIMEOUT (agent 周期调用)
check_and_cleanup_expired_locks(): 扫描 locked_until < now 的 session → release
_lock_active(): locked_until > now
```

v2 设了 TTL 但：无 check_and_cleanup（过期 lock 永远不释放）、无 extend（长任务会超时）。

### SSE 事件 (api.py:237, 992-1206)

v1 用 `_sse_event(event_name, data)` 发 `event: {name}\ndata: {json}\n\n`。
命名事件：`status` / `thinking` / `plan_ready` / `search_progress` / `analysis` / `report` / `done` / `error` / `waiting` / `heartbeat`(每30s)。

v2 只发 `data: {json with type field}\n\n` — 无 `event:` 行。

## v2 对齐方案

### 控制端点通用模式

每个控制端点统一为：记录 step → 状态转移 → 确保恢复。

```ts
async function controlAction(id, action) {
  const research = getResearch(id);
  recordStep(research, action); // 写 researchSteps
  research.status = inferNextStatus(action, research);
  if (action === 'skip') research.iteration++;
  if (action === 'finish') await generateReport(research);
  ensureResumed(research); // 如果没有活跃 stream，启动新的
  return research;
}
```

### resume 状态推断

复刻 `_infer_resume_state`：查 `researchSteps` 最后一条的 type+action → 推断 status。

### report 生成 (finish)

finish 后调 `generateFinalReport(research)` — 对齐 v1 graph 的 GenerateReport 节点：

- 汇总所有 iteration 的 search results
- LLM 生成结构化报告
- 存入 `finalReport`

### lock 管理

- 服务端启动时调 `cleanupExpiredLocks()`（定期或按需）
- agent 循环内周期调 `extendLock(id)`

### SSE 命名事件

改 `_sse_event` 等价：每条 SSE 消息加 `event: {name}` 行。

## 不做的事

- 不引入 pydantic-graph 等价物（v2 用 agent loop，保留）
- 不改 research 的 ToolLoopAgent 架构（c24 已决定延迟 toolApproval 到 c13）
- 不改 search engine 本身（SearXNG 调用在 agent.ts 已有）
