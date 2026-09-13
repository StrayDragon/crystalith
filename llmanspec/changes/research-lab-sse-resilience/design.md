# Design：research-lab-sse-resilience

## 1. Spec 增量（apply 时在绑定分支编辑 live spec）

在 `llmanspec/specs/deep-research-ui/deep-research-ui.feature` 的「SSE and terminal GET refresh
align node fields」场景（:129）之后**新增场景**：

```text
  场景: Run SSE reconnects with bounded backoff and visible state
    - Run SSE 意外断开（网络错误、非用户离开、非终态结束）时，客户端 MUST 立即对账
      GET ResearchRun；若 Run 处于非终态 MUST 以有界退避自动重订阅同一 SSE 端点
      （默认 1s/2s/4s，至多 5 次或直至终态，取先到者）；重连期间 UI MUST 呈现可见的
      「连接中断，正在重连」状态且 MUST NOT 渲染伪造进度；重连成功后 MUST 以
      GET progress gap-fill + 后续 SSE 事件补齐中断窗口；重试耗尽或对账发现终态
      MUST 停止重试，前者 SHALL 提供明确错误与手动重试入口；用户主动离开页面或
      Run 进入终态后 MUST NOT 继续重连。MUST NOT 为此引入 notebook 级 list SSE（r17）。
```

注意：此条款约束的是**客户端行为**，不新增 wire 事件/端点；AsyncAPI 无需新增通道。

## 2. server：run-sse 终态等待去轮询

现状 `run-sse.ts:68-88` 每 `tick` 同步查表 + `setTimeout(tick, 100)`。改为：

```ts
// 示意：终态 promise = 广播订阅 + 100ms 粒度兜底轮询保留但间隔放宽（或纯广播 + 30s 兜底）
await new Promise<void>((resolve) => {
  const unsubBroadcast = subscribeRunStatus(runId, (status) => {
    if (isTerminal(status)) setTimeout(resolve, 50); // 允许尾帧 flush
  });
  // 兜底：广播丢失（进程内 Map 生命周期错位等）时由慢轮询救场
  const slowTick = () => {
    if (closed || queryTerminal()) resolve();
    else setTimeout(slowTick, 2000);
  };
  slowTick();
  // finally: unsubBroadcast()
});
```

- 复用既有 `runEmitters` 广播通路；新增订阅点放 `run-sse.ts`（或 `research-core.ts` 的
  emitter 模块），不新造第二套 pubsub。
- `closed`（客户端断开）分支保持即时 resolve。
- 慢轮询间隔取 2s（纯兜底语义，不再是主信号）；若实现中发现广播已足够可靠，可整段删除
  轮询——以删除为默认目标，保留需在 PR 说明理由。

## 3. client：重连语义落点（二选一，默认 A）

**A（默认）：`api/stream.ts` 提供可复用 wrapper。**

```ts
// 示意
export async function* streamWithReconnect(makeStream: () => Promise<SseStream>, opts: {
  onStateChange: (s: 'ok' | 'reconnecting' | 'exhausted') => void;
  backoffMs?: number[]; // 默认 [1000, 2000, 4000]
}): SseStream
```

- 断开判定：生成器正常结束（server 主动关）或 throw。正常结束 ≠ 终态（server 只在终态
  或客户端取消时关连接），所以 wrapper 结束后回调 controller 做一次对账，非终态则退避重试。
- controller（`useEdenLabController.startStream`）把现有「finally 一次对账」替换为
  wrapper 回调：`reconnecting` → UI 状态位；`exhausted` → `lastError`（走 mapTransportError
  风格文案）+ 暴露手动重试（复用既有 `withBusy(startStream)` 入口即可，不新建机制）。
- 重连成功首帧前执行既有 `getResearchRun` 全量对账 + `progress` gap-fill（r170 机制），
  保证中断窗口补齐。

**B（备选）：controller 内 while 循环。** 不改 `stream.ts`，逻辑集中但不可复用、难单测。
仅当 A 的抽象被证伪（如事件语义无法泛化）时采用，需在 PR 说明。

## 4. UI 状态面

- `LabController` 状态增加 `streamState: 'ok' | 'reconnecting' | 'exhausted'`（或等价），
  demo/fixture 分支恒为 `'ok'`（接口面已宽，加一个必填字段成本可控；`model/labController.ts`
  同步）。
- 呈现位置：Lab 顶栏既有 banner 位（`ResearchLabPage.tsx:614-640` 的横幅带）追加一条
  「连接中断，正在重连…（N/M）」/「连接已断开，重试」横幅，复用现有 banner 样式，
  **遵循 Layer 体系**（不得新增 Tailwind 裸 z-*）。
- fixture/demo 模式不触发任何重连逻辑（stream 层不经过此路径，天然满足）。

## 5. 风险登记

| 风险                                                            | 等级 | 缓解                                                                       |
| --------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| 重连风暴（多标签页同时退避）                                    | 低   | 有界退避 + 上限 5 次；SQLite 单机写读路径扛得住；不做 jitter（单用户产品） |
| 广播订阅与 SSE 生命周期错位导致 resolve 丢失                    | 中   | 保留慢轮询兜底（§2）；单测覆盖「广播早于订阅到达」与「广播永不到达」       |
| controller 872 行，改动面与 `useEdenLabController` 既有债务重叠 | 中   | 只动 `startStream` 与状态位，不做结构性拆分（拆分归台账 W6，避免撞车）     |
| e2e flaky（人为断连难注入）                                     | 中   | 单测用 fake timers 覆盖状态机；e2e 不强制覆盖重连路径，p0 仅回归不劣化     |

## 6. 测试计划

- server 单测：终态广播 → SSE 关闭（<100ms，无轮询依赖）；广播丢失 → 慢轮询兜底关闭；
  客户端断开 → 即时清理。
- web 单测（fake timers）：断开 → 对账 running → 按 backoff 重试 → 第 N 次成功后 gap-fill
  被调用；耗尽 → `exhausted` + 停止；对账即终态 → 不重试。
- Rstest：`reconnecting/exhausted` 状态渲染横幅与手动重试入口。
- `just e2e` p0 回归（含 SSE 长任务路径）。
