## Context

- 后端与前端测试中存在多处对真实时间/调度的依赖（`sleep`、`perf_counter` 差值阈值、极短 TTL、短轮询窗口）。
- 这些测试在不同机器负载、CI runner、线程池调度下容易随机失败，造成 flake。

## Goals / Non-Goals

**Goals:**
- 将关键 flaky 测试改为确定性同步：用事件/屏障替代时间阈值；用可控时钟或 fake timers 替代真实时间推进。
- 保持测试覆盖意图不变（验证“不会阻塞事件循环/正确取消/TTL 失效/正确发事件”），仅替换脆弱的时间断言。

**Non-Goals:**
- 不重写整个测试体系；只针对已识别的高风险测试做稳定性修复。

## Decisions

### 1) 后端并发/执行器相关测试用“屏障”替代 `perf_counter` 阈值
**Decision:** 对 `test_sources_api.py` 的 `_SlowParser` 使用 `threading.Event` 作为屏障：
- `parse()` 一进入就 `started.set()`，随后 `continue.wait()`，直到测试明确放行
- 测试在 slow upload 启动后等待 `started`，再发起 quick request，断言 quick 能在不放行 slow 的情况下完成

**Rationale:** 断言“quick 不被 slow 阻塞”无需依赖毫秒级时间差；屏障提供确定性。

### 2) TTL 失效测试使用可控时钟（monotonic monkeypatch）
**Decision:** 对 `InMemoryCache` 依赖的 `time.monotonic()` 做 monkeypatch，使用可控计数器推进时间，避免 10ms 级 sleep。

**Rationale:** 极短 TTL + sleep 是典型 flake 来源；可控时钟能做到 0ms、100% 可重复。

### 3) 前端定时器测试统一使用 fake timers
**Decision:** 对 Vitest 中依赖真实 `setTimeout` 的用例启用 `vi.useFakeTimers()`，并用 `vi.advanceTimersByTime()` 推进。

**Rationale:** 避免真实时间等待与机器负载影响；缩短测试时间并提升稳定性。

### 4) SSE/轮询相关测试用“读事件直到满足条件”替代固定 sleep
**Decision:** 将 `await sleep(X)` 改为“在总体超时内循环读取/等待直到看到目标事件”，并将轮询间隔配置为可注入（测试内缩短/禁用等待）。

**Rationale:** 固定 sleep 假设调度必定在窗口内发生；基于条件等待更稳健。

## Risks / Trade-offs

- **[风险]** 引入同步屏障会改变测试结构、增加样板代码 → **缓解**：封装 test helper（例如 `BarrierParser`）并复用。
- **[风险]** monkeypatch time 可能影响同文件其他用例 → **缓解**：作用域限定在单测内，并在 fixture 结束时还原。

## Migration Plan

- 分批落地：先修复最不稳定的用例（sources executor、TTL、frontend timers），再处理 SSE/worker 生命周期测试。
- 合并后在 CI 观察 flake 率（至少 1-2 天）并必要时继续迭代。

## Open Questions

- 后端 SSE 测试是否需要引入专门的“stream 测试 helper”（统一超时、事件收集、断言）以减少重复与 flake。
