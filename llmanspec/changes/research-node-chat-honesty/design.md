# Design：research-node-chat-honesty

## 1. Spec 增量（apply 时在绑定分支编辑 live spec）

在 `llmanspec/specs/deep-research-runtime/deep-research-runtime.feature` 的
「Node chat SSE proposals only」场景之后**新增场景**（req id 以 `llman sdd spec` 工具分配为准）：

```text
  场景: Node chat failure is honest
    - 模型调用失败（provider 错误、网关不可达、输出非法）时，系统 MUST 以 chat SSE 的
      error 事件终结本轮对话（携带 errorCode 与用户可读 message），MUST NOT 以 stub、
      模板或占位正文冒充模型回复；progress ledger MUST 记录对应 chat 失败事件。
      stub 回复路径 MUST 仅在显式非生产开关（CL_RESEARCH_E2E_STUB=1）下可达，
      且该开关开启时 progress 事件 MUST 携带 via='stub' 标记。
      用户主动中止（abort）语义不变（error 事件 + chat_aborted 账本事件）。
```

同步核对 `deep-research-ui.feature:137-138`（Eden node chat 场景）：若其中未约定 error
事件的用户可见处理，补一句「chat error 事件 MUST 以可见错误态呈现（对话区错误提示），
MUST NOT 静默无反馈」。

## 2. 行为设计

### 2.1 失败路径（node-chat.ts）

现状 `:264-289` 的 `catch (agentError) { usedAgent = false; logger.warn(...) }` 改为：

- `ac.signal.aborted` → 维持现状（抛出/abort 语义，`:268` 已有）。
- 其他异常 → `logger.error` + `appendProgressEvent(runId, 'chat_failed', { nodeId, headline, message })`
  - `emit('error', { errorCode, message })` 后 return。errorCode 用 `ErrorCode.INTERNAL_ERROR`
    （与既有人工错误帧一致）；message 走用户可读文案（「模型暂时不可用，请稍后重试」），
    原始异常进 server 日志，不直接透出。
- 删除 `!usedAgent` 分支的生产可达性：`stubNodeChatTurn` 调用整体包进
  `if (getResearchE2eStubEnabled())`（复用 `e2e-stub.ts` 既有 env 读取；若该开关函数未导出
  则导出它，不复制 env 判断）。开关关闭时 stub 分支不可达——用 `apparently-unreachable` 的
  显式分支而非注释。

### 2.2 stub 的 e2e 保留

`CL_RESEARCH_E2E_STUB=1` 下行为与现状一致（stub 正文 + 假提案 + `via:'stub'`），
`e2e/tests/p0-eden-lab.spec.ts` 与 `apps/server/tests/research/e2e-stub*.test.ts` 不应感知变化。
若个别单测依赖「无开关时也出 stub」，改测试而不是加兼容层。

## 3. 契约接线设计

SSE 响应本体是 `text/event-stream`，Elysia response schema 不逐帧校验，接线目标定为
**emit 出口类型收窄 + dev/test 运行时断言**：

```ts
// node-chat.ts（示意）
type ChatEvent = ResearchNodeChatStreamEvent; // shared 判别联合
const emit = (event: ChatEvent) => {
  if (import.meta.env?.DEV ?? true) {
    const parsed = ResearchNodeChatStreamEventSchema.safeParse(event);
    if (!parsed.success) logger.error('[research] chat event contract violation', parsed.error);
  }
  // 既有 sse-response 帧序列化
};
```

- 逐个发射点（chunk/proposal/done/error/log）改为构造判别联合成员；本文件内所有
  `emit('xxx', {...})` 调用点收拢到该函数。
- shared schema 若与实际载荷有字段出入，以**实际行为为准修 schema**（schema 目前零消费，
  修正不是破坏），必要时补 `.describe(desc(...))`。
- 不给路由挂 `response`（SSE 逐帧校验不是 Elysia 的能力面，避免假门禁）；
  dev 断言 + 单测覆盖即达标。

## 4. web 侧最小配套

`useEdenLabController` / `LabNodeDrawer` 消费链路确认 `error` 事件已有分支
（`LabNodeDrawer.tsx:291-371` Eden 分支）；若 error 仅写日志无 UI 反馈，补对话区内联错误
文案（复用既有错误样式），不做重连/重试设计（那是 `research-lab-sse-resilience` 的主题）。

## 5. 风险登记

| 风险                                           | 等级 | 缓解                                                                       |
| ---------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| e2e @p0 依赖 stub 回复                         | 中   | playwright.config 已设 `CL_RESEARCH_E2E_STUB: '1'`，先本地 `just e2e` 验证 |
| shared schema 与实际载荷不符导致接线期大面积改 | 低   | 以实际为准修 schema（零消费窗口期，唯二成本是 diff 审阅）                  |
| 前端把 error 帧当静默失败                      | 低   | §4 最小 UI 配套纳入验收                                                    |

## 6. 测试计划

- 单测（`apps/server/tests/research/`）：agent 抛错（mock agent reject）→ SSE 收到 `error` 帧、
  ledger 有 `chat_failed`、无 stub chunk；`CL_RESEARCH_E2E_STUB=1` → stub 路径仍可用且 `via:'stub'`。
- 契约测试：emit 出口 safeParse 断言在 dev 下对全部事件型别成立（可直接对构造样本跑 schema）。
- web Rstest：chat error 事件渲染错误态（若 §4 落了 UI）。
- 门禁：`just qa` 全绿。
