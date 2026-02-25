## 1. 后端：sources executor 测试去时间阈值

- [x] 1.1 修改 `backend/py/tests/features/sources/test_sources_api.py::test_upload_source_parse_runs_in_executor_without_blocking_requests`：用 `threading.Event` 屏障控制 `_SlowParser.parse`，移除 `perf_counter` 差值断言
- [x] 1.2 修改 `backend/py/tests/features/sources/test_sources_api.py::test_upload_three_sources_concurrently_keeps_response_times_stable`：用多个屏障协调 slow uploads，在不依赖 0.5s/1.5s 阈值的情况下断言 quick upload 可完成

## 2. 后端：研究流与任务队列测试去固定 sleep

- [x] 2.1 修改 `backend/py/tests/features/research/test_research_stream_progress.py`：用“读取事件直到满足条件（总体超时）”替代 `await asyncio.sleep(1.5)`
- [x] 2.2 修改 `backend/py/tests/features/tasks/test_task_queue_lifecycle.py`：将 worker 的 `await asyncio.sleep(60)` 替换为等待 `asyncio.Event`，并扩大/稳定“等待 RUNNING”的条件等待逻辑

## 3. 后端：TTL 测试使用可控时钟

- [x] 3.1 修改 `backend/py/tests/shared/test_retrieval_assembly_cache.py::test_retrieve_context_assembly_cache_ttl_expires`：monkeypatch `crystalith.shared.cache.in_memory.time.monotonic`，通过推进假时钟触发过期，移除 10ms 级 sleep

## 4. 前端：定时器测试使用 fake timers

- [x] 4.1 修改 `frontend/web/src/features/workspace/shared/hooks/useOutputQueue.test.tsx`：启用 `vi.useFakeTimers()`，用 `advanceTimersByTime()` 替代真实 `setTimeout(200)`

## 5. 运行与验收（含 DevTools）

- [x] 5.1 后端：`cd backend/py && just test`
- [x] 5.2 前端：`cd frontend/web && pnpm test`
- [x] 5.3 部署后快速回归（可选）：启动前后端 dev server，在 DevTools 中确认关键路径（sources 上传、research SSE、输出队列）仍能触发对应请求且无控制台错误
