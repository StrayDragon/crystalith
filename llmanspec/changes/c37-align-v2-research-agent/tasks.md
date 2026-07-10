# align-v2-research-agent — Tasks

## 1. 控制端点逻辑修复

- [ ] `features/research/router.ts`: approve — 记录 user_input(approve) step + 确保 resume（非依赖轮询）
- [ ] `features/research/router.ts`: modify — 记录 user_input(modify) step + 存新 plan 到 inputData + 设 PLANNING + resume
- [ ] `features/research/router.ts`: skip — 记录 user_input(skip) step + 推进 iteration（或 complete）+ 设 PLANNING + resume
- [ ] `features/research/router.ts`: finish — 记录 user_input(finish) step + 设 COMPLETED + 触发 report 生成
- [ ] `features/research/router.ts`: cancel — 记录 user_input(cancel) step + 设 CANCELLED + release lock

## 2. resume 状态推断

- [ ] `features/research/router.ts`: 实现 `_infer_resume_state` 等价 — 查 researchSteps 最后一条的 type+action 推断 status/iteration
- [ ] `features/research/router.ts`: resume 端点用推断结果而非强制 planning

## 3. report 生成

- [ ] `features/research/agent.ts`: 新增 `generateFinalReport(research)` — 汇总 search results + LLM 生成结构化报告 → 存 finalReport
- [ ] finish 端点调用 generateFinalReport

## 4. DELETE 端点

- [ ] `features/research/router.ts`: 新增 `DELETE /v2/research/:id` — if running → cancel → delete

## 5. lock 管理

- [ ] `features/research/router.ts` 或 `shared/`: 实现 `cleanupExpiredLocks()` — 扫描过期 locked_until
- [ ] `features/research/agent.ts`: agent 循环内周期调 `extendLock(id)`

## 6. stream auto-resume

- [ ] `features/research/router.ts`: stream 端点检测 stale session (running 但无活跃 stream) → 启后台 resume

## 7. export note 类型

- [ ] `features/research/router.ts`: export 端点支持 `export_type='note'` → 创建 Output

## 8. SSE 命名事件

- [ ] `features/research/router.ts`: SSE 消息加 `event: {name}` 行（status/thinking/plan_ready/done/error/waiting/heartbeat）
- [ ] heartbeat: 每 30s 发空 heartbeat 事件

## Verification

```bash
cd apps/server && bun test features/research
# resume 状态推断测试（各 step type 场景）
# skip 推进 iteration 测试
# finish 生成 report 测试
# delete 端点测试
# SSE 事件命名格式测试
# lock 过期清理测试
```
