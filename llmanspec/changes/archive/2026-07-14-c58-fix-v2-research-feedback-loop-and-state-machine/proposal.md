---
depends_on: []
batch: all
---

# c58-fix-v2-research-feedback-loop-and-state-machine — research 反馈环 + 状态机细节 + 锁续期 + finish 哨兵

## Why

2026-07-13 第七轮深度审计发现 research agent 存在 5 个 P1（行为实质偏离），集中在状态机转换细节、反馈环断裂、锁续期策略、finish 哨兵字符串。这些影响研究质量与稳定性，但不阻塞核心 plan→search→reflect→report 循环。

### 实现违反

1. **P1-A：`suggested_queries` 反馈环断裂**。v2 `agent.ts:107` 的 plan prompt 不接收上一轮 analyze 的 `suggestedQueries`。v1 `graph.py:170-171` 传入 prior analysis 的 suggested_queries 作为"Suggested focus areas"。reflect→plan 改进循环静默失效——每轮 plan 不知道上轮 analyze 发现的焦点方向。
2. **P1-B：锁续期按迭代而非周期**。v2 `agent.ts:428` 每轮循环续期一次；v1 `api.py:885-899` 后台每 300s 续期。单轮（plan+search+analyze，含多 LLM 调用 + 10s 超时搜索）超 10min 时，v2 锁过期导致 cleanupExpiredLocks 误取消会话。慢模型/大结果场景高风险。
3. **P1-C：`/finish` 可能持久化哨兵字符串**。v2 `router.ts:519` 的 `generateFinalReport` 失败时写 `'(report generation failed)'` 作为 `finalReport`。该字符串通过 `/export` 的 `if (!row.finalReport)` 守卫（router.ts:598），产生垃圾 source。v1 `graph.py:811-823` 总是生成真实 fallback report（从结果列表合成最小报告），永不写哨兵。
4. **P1-D：SSE `/stream` 不自动 resume 卡住会话**。v1 `api.py:972-983` 检测锁过期（`_should_resume_research`）并在 stream handler 内触发 resume。v2 `router.ts:706-796` 只轮询，客户端重连 stalled 会话必须手动调 `/resume`。
5. **P1-E：skip 跳过 Analyze 步骤**。v1 `graph.py:364` skip → AnalyzeResults（分析累积结果后再决定 re-plan 或 report）。v2 `agent.ts:484-489` skip → `continue` 到下一轮 plan，**丢弃 analyze 步骤**。影响 skip-to-finish 路径的报告质量。

### v1 参考（正确行为）

- `backend/py/.../research/graph.py:170-171` —— plan prompt 传入 `analysis.suggested_queries`。
- `backend/py/.../research/api.py:885-899` —— `_extend_lock_periodically` 每 300s 续期。
- `backend/py/.../research/graph.py:811-823` —— GenerateReport fallback 从结果列表合成最小报告。
- `backend/py/.../research/api.py:972-983` —— stream handler 内 `_should_resume_research` 检测。
- `backend/py/.../research/graph.py:364` —— WaitForApproval skip → AnalyzeResults。

## What Changes

1. **`apps/server/src/features/research/agent.ts`** —— plan prompt 加入 prior analysis 的 `suggestedQueries`（如有）作为"Suggested focus areas"段落。
2. **`apps/server/src/features/research/agent.ts`** —— 锁续期改为周期性：用 `setInterval` 每 300s 调 `renewLock`，循环结束清理。或每轮续期 + 每轮内 LLM 调用前检查 TTL 剩余 < 阈值时续期。
3. **`apps/server/src/features/research/router.ts`** —— `generateFinalReport` 失败时调用 fallback：从 `aggregatedResults` 合成最小报告（标题 + 结果列表摘要），永不写哨兵字符串。
4. **`apps/server/src/features/research/router.ts`** —— SSE `/stream` handler 开头检测 `_shouldResumeResearch`（status active 且锁未持有），触发 resume。
5. **`apps/server/src/features/research/agent.ts`** —— skip 分支改为先执行 analyze（对累积结果），再 `continue` 到下一轮 plan（对齐 v1 graph.py:364 skip→AnalyzeResults）。
6. **测试** —— suggested_queries 反馈测试 + 锁续期周期性测试 + finish fallback 不写哨兵测试 + stream auto-resume 测试 + skip→analyze 路径测试。

## Capabilities

- `workspace-api-contract` —— MODIFIED r36（control endpoints record steps：细化 skip MUST 经 Analyze）+ MODIFIED r37（finish report：MUST 不写哨兵）+ ADDED r40（plan MUST 传入 prior suggested_queries）+ ADDED r41（stream MUST auto-resume stalled）

## Impact

- **无 BREAKING**（内部行为修正，端点契约不变）。
- **用户可见改进**：研究质量提升（反馈环接通）；稳定性提升（锁不误过期）；skip 路径报告更完整；stalled 会话自动恢复。
- **风险**：低-中。锁续期改周期性需注意 setInterval 清理（循环正常结束/异常/cancel 时 clearInterval）。finish fallback 需保证 aggregatedResults 非空时有内容可合成。
- **依赖**：独立于 c57/c59–c62；不阻塞 c13/c14。
