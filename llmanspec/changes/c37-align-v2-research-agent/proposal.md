---
depends_on: [c24-add-v2-pipeline-integration]
batch: all
---

# c37-align-v2-research-agent — Research agent v1 行为对齐

## Why

c22 (research-agent) 标 DONE、c24-B (resume/export/modify) 标 DONE，但 2026-07-10 v1↔v2 对拍发现 research 的 4 个核心控制端点逻辑全部偏离 v1：

- **resume 未真正重建状态** [P0]: v1 `_infer_resume_state` (api.py:185-229) 检查 steps 推断恢复点（PLANNING/WAITING_USER/SEARCHING/ANALYZING/COMPLETED）。v2 `router.ts:328-345` 强制设 `planning` 重跑 — 丢失中间迭代状态和累积结果。
- **skip 逻辑错误** [P0]: v1 (api.py:591-647) 记录 skip step + 推进 iteration + 设 PLANNING + 恢复。v2 `router.ts:285-293` 设 `searching` 但不记 step 不推进 iteration — 重跑同一 plan。
- **approve 不恢复 agent** [P0]: v1 (api.py:483-534) 记 user_input step + 启后台 resume task。v2 `router.ts:228-243` 只翻 status，依赖轮询 agent 存活；若 stream/poll 已关则永久卡死。
- **finish 不生成报告** [P0]: v1 (api.py:650-687) 设 COMPLETED 后 graph 的 GenerateReport 节点跑。v2 `router.ts:296-304` 设 completed 但不生成报告，`finalReport` 永远 null → export 坏。
- **DELETE 端点缺失** [P1]: v1 (api.py:440-463) cancel-if-running 然后 delete。v2 无 delete — research 只能累积。
- **无 lock 过期清理** [P1]: v1 有 `check_and_cleanup_expired_locks` + `extend_lock` (api.py:109-164,885-899)。v2 设 TTL 但无清理/延长 — crash 后永久锁死。
- **stream 不自动恢复 stale session** [P1]: v1 检查 `_should_resume_research` 启后台 resume (api.py:972-983)。v2 纯被动轮询。
- **export 缺 note 类型** [P1]: v1 支持 `export_type='source'|'note'` (api.py:1431-1463)。v2 只有 source 路径。
- **SSE 事件无 event: 字段名** [P1]: v1 发命名事件 (status/thinking/plan_ready/search_progress/analysis/report/done/error/waiting/heartbeat)。v2 只发无命名的 data: JSON。

## What Changes

1. **resume**: 实现 `_infer_resume_state` 等价逻辑 — 检查 last step type + user_input action 推断恢复状态
2. **skip**: 记录 skip step + 推进 iteration（或到达上限则 complete）+ 设 PLANNING + 恢复
3. **approve**: 记录 user_input step + 确保后台 resume（不依赖轮询 agent 存活）
4. **finish**: 设 COMPLETED + 触发 report 生成
5. **DELETE 端点**: 新增 `DELETE /v2/research/:id` — cancel-if-running 然后 delete
6. **lock 管理**: 过期 lock 清理 + 周期延长
7. **stream auto-resume**: 检测 stale session 启后台恢复
8. **export note 类型**: 支持 `export_type='note'` 创建 Output
9. **SSE 命名事件**: 发 `event:` 字段（status/thinking/plan_ready/done/error/waiting/heartbeat）

## Capabilities

- workspace-api-contract (spec delta: research 控制端点契约 + SSE 事件形状)

## Impact

- **BREAKING**: research SSE 事件从无命名 data: 改为命名 event:（前端需适配）
- research 控制端点行为变化（resume/skip/approve/finish 从 stub 变为真实逻辑）
- 新增 DELETE 端点
