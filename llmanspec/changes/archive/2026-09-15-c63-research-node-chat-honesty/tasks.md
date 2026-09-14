# Tasks — c63-research-node-chat-honesty

> Seam：
> ① `bun test apps/server/tests/research/`（node-chat 行为 + 契约）
> ② `just test-web`（chat error UI，若 T4 落地）
> ③ `just e2e`（`CL_RESEARCH_E2E_STUB=1` 全链路不回归）
> ④ `just qa`（收口）
>
> spec 编辑（T0）必须在绑定分支上进行（`llman sdd change start` 之后）。

## T0 live spec 增量

- [x] 按 design §1 在 `deep-research-runtime.feature` 新增「Node chat failure is honest」场景；核对/补 `deep-research-ui.feature:137` 场景的 error 可见性子句
- [x] `llman sdd validate` 绿
- 验证：validate 输出无 unbound/漂移告警（39/39 passed，含 r12 分配）

## T1 server 失败语义 [blocked-by: T0]

- [x] `node-chat.ts:264-289`：agent 异常（非 abort）→ `logger.error` + ledger `chat_failed` + `emit('error')` 终结，删除静默 `usedAgent=false` 降级
- [x] `stubNodeChatTurn` 调用收进 `CL_RESEARCH_E2E_STUB` 显式开关（复用 `e2e-stub.ts` 的开关读取，不复制 env 判断）；开关关闭时生产不可达
- [x] e2e 开关开启路径行为不变（stub 正文 + 假提案 + `via:'stub'`）
- 验证：`bun test apps/server/tests/research/` 新增用例绿（`node-chat-honesty.test.ts` 6 用例）

## T2 契约接线 [blocked-by: T0]

- [x] node-chat emit 出口改为 `ResearchNodeChatStreamEvent` 判别联合（design §3），dev/test safeParse 断言
- [x] shared `research.ts:688-715` schema 与实际载荷对齐（以实际为准），字段补 `desc()`；删除确认无用的成员（如 Log 若无发射点，删 schema 而不是留死契约）
- [x] 路由层不加假 response 门禁（SSE 不逐帧校验，design §3 说明为准）
- 验证：`grep -rn 'ResearchNodeChatStreamEventSchema' apps/` 有真实消费（node-chat.ts emit 出口）；`bun typecheck` 绿

## T3 web 最小配套

- [x] `LabNodeDrawer` Eden chat 分支确认 `error` 事件 → 对话区可见错误态（缺则补最小实现）（已有 `setChatError` + `role="alert"` 渲染，`:343-356`/`:577-582`）
- [x] Rstest 覆盖 error 事件渲染（`LabNodeDrawer.chat.test.tsx`「chat error event is visible」已存在且绿）
- 验证：`just test-web` 绿（84/84）

## T4 回归与收口

- [x] 单测：mock agent reject → error 帧 / ledger / 无 stub chunk；`CL_RESEARCH_E2E_STUB=1` → stub 可用
- [x] `just e2e`（p0-eden-lab 全绿，31 passed）
- [x] `just qa` 全绿 → `llman sdd change finalize`
