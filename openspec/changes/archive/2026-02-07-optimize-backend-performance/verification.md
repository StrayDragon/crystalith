# optimize-backend-performance 验收记录

> 执行日期：2026-02-07

## 执行命令

```bash
cd backend/py
uv run pytest -n 0 tests/shared/test_ai_providers.py tests/features/sources/test_sources_api.py tests/features/qa/test_qa_api.py tests/features/refine/test_refine_api.py tests/features/analysis/test_correlation.py tests/features/analysis/test_contradiction.py tests/features/test_error_responses.py -q
uv run python scripts/benchmark_optimize_backend_performance.py
```

## 测试结果

- `pytest`：`20 passed in 2.99s`
- 基准报告：`openspec/changes/archive/2026-02-07-optimize-backend-performance/benchmark-results.json`（`passed: true`）

## 任务验收映射

| 任务 | 验收方式 | 结果 |
|---|---|---|
| 1.4 / 1.5 | `benchmark_optimize_backend_performance.py` ANN vs 暴力检索（100/500/1000） | 全部通过：ANN 延迟比为 `0.3362 / 0.1412 / 0.1187`，召回率均为 `1.0` |
| 2.7 | 同一基准脚本，500 chunk 嵌入吞吐对比 | 通过：`3549.438ms -> 777.152ms`，`4.567x` 提升 |
| 3.5 | 同一基准脚本，QA 串行 vs 并行路径模型 | 通过：`811.171ms -> 561.003ms`，延迟下降 `30.84%` |
| 4.5 | 同一基准脚本，10 source / 200 chunk 跨文档分析 | 通过：`1885.967ms -> 625.516ms`，延迟下降 `66.83%` |
| 5.4 | `test_upload_three_sources_concurrently_keeps_response_times_stable` | 通过：3 并发上传全部成功，快请求不阻塞，上传耗时保持稳定 |
| 6.5 | `test_openai_chat_provider_retries_timeout_and_returns_success` | 通过：模拟首次超时后重试成功，调用次数为 2 |
| 7.4 | 同一基准脚本，Refine 串行 vs 并行 | 通过：`540.776ms -> 180.358ms`，延迟下降 `66.65%` |

## 说明

- 3.5 与 7.4 的“优化前”采用变更前串行逻辑等价模型进行对比；“优化后”采用当前并行策略（`asyncio.gather` / `Semaphore`）模型，结果可复现于脚本输出。
- 5.4 与 6.5 已补充为自动化测试，避免仅手动验收的不可重复性。
