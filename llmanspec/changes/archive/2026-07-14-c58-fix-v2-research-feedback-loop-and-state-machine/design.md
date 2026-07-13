# c58 Design — research 反馈环 + 状态机 + 锁续期 + finish fallback

> SSOT: `backend/py/src/crystalith/features/research/{api.py,graph.py}`

## 决策

### D1: suggested_queries 反馈——plan prompt 增量

v2 agent.ts 的 `planSearches` prompt 当前只传 topic/iteration/result count。改为：若上一轮 analyze 产生了 `suggestedQueries`（非空数组），追加一段 "Suggested focus areas (from previous analysis):" 到 prompt。这需要 agent loop 在 analyze 后把 `analysis.suggestedQueries` 存入 state（或闭包变量），供下一轮 plan 读取。

### D2: 锁续期——周期性 setInterval vs 每轮检查

v1 用独立后台 task 每 300s 续期（`_extend_lock_periodically`，api.py:885-899）。v2 选项：

- **(A) setInterval 每 300s**：循环开始启动，结束 clearInterval。需注意所有退出路径（正常/cancel/异常）都清理。
- **(B) 每轮续期 + 每轮内 LLM 调用前检查 TTL**：在 planSearches/analyze/generateReport 等长操作前，检查锁 TTL 剩余 < 120s 时续期。

选 **(A)**：更接近 v1 语义，且 setInterval 在 Bun 中可靠。清理用 try/finally 包裹整个 runResearch 函数。

### D3: finish fallback——从 aggregatedResults 合成最小报告

v1 `graph.py:811-823` fallback 逻辑：若 LLM 报告生成失败，从 `state.all_results` 取前 N 条，合成 "## 研究结果摘要\n\n" + 结果列表（title + url + snippet 截断）。v2 移植：`generateFinalReport` catch 块内，若 `results.length > 0`，合成 markdown；若空，写明确的"（研究未收集到结果）"而非 `'(report generation failed)'`（后者是技术性哨兵，前者是语义性空状态）。

关键：fallback 写入的 `finalReport` 必须是**有意义的中文内容**，即使质量低，也不能是技术哨兵字符串（避免通过 export 守卫产生垃圾 source）。

### D4: stream auto-resume——复用 _shouldResumeResearch 判断

v2 `inferResumeState` 已存在（router.ts:218-298）。stream handler 开头加：查 research session，若 status ∈ {planning, searching, analyzing, waiting_user} 且锁未被持有（`activeResearch` map 无记录 或 锁过期），则调 `spawnResearch(session.id, runResearchFromState)` 自动 resume。对齐 v1 `api.py:972-983`。

### D5: skip→analyze——在 continue 前插入 analyze

v2 agent.ts:484-489 当前：

```ts
case 'skip': continue; // 直接下一轮
```

改为：

```ts
case 'skip':
  // v1 graph.py:364: skip → AnalyzeResults（分析累积结果）
  const skipAnalysis = await analyzeResults(topic, state.results, iteration);
  state.lastAnalysis = skipAnalysis;
  continue; // 然后下一轮 plan（plan 能读到 skipAnalysis.suggestedQueries）
```

这同时让 D1 的反馈环在 skip 路径也生效。

## 涉及文件

### 修改

- `apps/server/src/features/research/agent.ts` —— plan prompt +suggestedQueries；锁续期 setInterval；skip→analyze
- `apps/server/src/features/research/router.ts` —— finish fallback 合成；stream auto-resume

### 新增测试

- `apps/server/test/research/feedback-loop.test.ts` —— suggested_queries 出现在第 2 轮 plan prompt
- `apps/server/test/research/lock-renewal.test.ts` —— 长时间运行锁不过期
- `apps/server/test/research/finish-fallback.test.ts` —— LLM 失败时 finalReport 是有意义内容非哨兵
- `apps/server/test/research/stream-auto-resume.test.ts` —— stalled 会话重连触发 resume
- `apps/server/test/research/skip-analyze.test.ts` —— skip 后 analyze step 被执行
