# Tasks — c64-research-lab-sse-resilience

> Seam：
> ① `bun test apps/server/tests/research/`（run-sse 生命周期）
> ② `just test-web`（controller 状态机 + UI）
> ③ `just e2e`（p0 回归）
> ④ `just qa`（收口）
>
> spec 编辑（T0）必须在绑定分支上进行。允许 server（T2）与 client（T3）并行推进。

## T0 live spec 增量

- [x] 按 design §1 在 `deep-research-ui.feature` 新增「Run SSE reconnects with bounded backoff and visible state」场景（req r13）
- [x] `llman sdd validate` 绿
- 验证：validate 无 unbound/漂移告警

## T2 server 终态等待去轮询

- [x] `run-sse.ts` 终态等待改为订阅既有 status 广播 + 慢轮询兜底（design §2），删除 100ms 主循环
- [x] 单测：广播命中即时关闭 / 广播丢失兜底 / 客户端断开即时清理（`run-sse-terminal.test.ts` 3 用例：87ms / ~2s / 30ms）
- 验证：`bun test apps/server/tests/research/` 绿（100 pass）

## T3 client 重连状态机 [blocked-by: T0]

- [x] `api/stream.ts` 落地 `streamWithReconnect` wrapper（design §3-A）
- [x] `useEdenLabController.startStream` 接入 wrapper：对账→退避重试→gap-fill→`exhausted` 停止 + 手动重试入口（`retryStream`）
- [x] `LabController` 接口与 demo/fixture 实现补 `streamState`（恒 `'ok'`）+ `streamAttempt` + `retryStream`
- [x] 单测（fake timers）：重试序列 / 成功后 gap-fill / 耗尽停止 / 对账即终态不重试（`streamWithReconnect.test.ts` 5 用例）
- 验证：`just test-web` 绿

## T4 UI 呈现 [blocked-by: T3]

- [x] Lab 顶栏横幅带补「连接中断，正在重连（N/M）」/「连接已断开，重试」两态（`LabStreamBanner` 组件），样式复用既有 banner、z-index 走 Layer 体系（`useLayer('popover')`）
- [x] Rstest：两态渲染 + 手动重试触发（`LabStreamBanner.test.tsx` 3 用例）
- 验证：`just test-web` 绿（86 文件 331 用例）

## T5 回归与收口

- [x] `just e2e` 全量 p0（31 passed）
- [x] `just qa` 全绿 → `llman sdd change finalize`
