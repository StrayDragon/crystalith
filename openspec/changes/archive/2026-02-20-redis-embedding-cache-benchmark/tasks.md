## 1. Observability

- [x] 1.1 为 `CachedEmbeddingProvider.embed_batch` 增加 hit/miss 与 cache get/set 耗时统计（不改变返回值）

## 2. Benchmark

- [x] 2.1 增加 `backend/py/scripts/embedding_cache_bench.py`：支持 warmup + repeat，并输出 Redis memory/key 摘要与 cache 命中统计
- [x] 2.2 增加 `just` 入口（例如 `just embedding-cache-bench`）方便运行

## 3. Docs & tests

- [x] 3.1 更新 `docs/configuration.md`：记录 Redis embedding cache 开关/参数与 benchmark 使用方式
- [x] 3.2 增加单测：覆盖 cache stats 统计口径的关键分支（hit/miss/跳过缓存）

## 4. Validation

- [x] 4.1 运行后端测试并确保覆盖率门槛通过
