## Why

当前测试套件中存在多处依赖真实时间（`sleep`、`perf_counter` 阈值、极短 TTL）与调度时序的断言，在 CI 或资源紧张环境下容易随机失败（flaky）。这会降低 CI 信噪比，拖慢迭代，并掩盖真实回归。

需要将这些测试改为**确定性同步**：用事件/屏障替代时间阈值，用可控时钟/假定时器替代真实定时器，并为必要的时间窗口留出更稳健的边界。

## What Changes

- 后端 pytest：将依赖 wall-clock 的并发/队列/流式测试改为基于 `asyncio.Event`（或可注入的 time provider）进行同步；对 TTL 测试改为可控时间或更大余量。
- 前端 Vitest：将依赖真实 `setTimeout` 的测试改为 `vi.useFakeTimers()` + `advanceTimersByTime()`，并减少对环境性能的敏感性。
- 形成一份“测试稳定性准则”规范（作为本 change 的 capability），用于后续 PR 评审与新增测试时遵循。

## Capabilities

### New Capabilities
- `test-stability`: 定义仓库内测试的稳定性准则（避免真实时间依赖、如何做确定性同步、如何使用 fake timers）。

### Modified Capabilities
- （无）

## Impact

- 受影响代码（预计）：
  - `backend/py/tests/features/sources/test_sources_api.py`
  - `backend/py/tests/features/research/test_research_stream_progress.py`
  - `backend/py/tests/features/tasks/test_task_queue_lifecycle.py`
  - `backend/py/tests/shared/test_retrieval_assembly_cache.py`
  - `frontend/web/src/features/workspace/shared/hooks/useOutputQueue.test.tsx`
- 产出：
  - CI flake 下降、回归更可定位、测试运行时间更可预期
