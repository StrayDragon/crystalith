## 1. Configuration

- [x] 1.1 在 Settings 中新增/扩展并发配置（embedding/vector_search/llm_generate 等）并提供安全默认值
- [x] 1.2 更新 `config/app.yaml` 示例与 `config/app.schema.json` 生成流程，确保 schema 校验通过

## 2. Implement limiters

- [x] 2.1 实现阶段级 limiter 抽象（可复用、可注入），并在 app 生命周期内复用实例
- [x] 2.2 在 outputs/slides/refine/qa 等入口接入 limiter（embedding/search/generate）
- [x] 2.3 补齐可观测性：记录 limiter 等待耗时、命中次数、并发上限

## 3. Cancellation and retries

- [x] 3.1 在请求取消时尽早停止后续阶段（含 streaming 路径），避免无效工作与副作用写入
- [x] 3.2 统一 429/503/timeout 的重试策略：遵循 Retry-After；设置最大重试次数与总预算；避免嵌套重试

## 4. Tests & validation

- [x] 4.1 增加回归测试：并发限制生效、取消语义正确、重试策略不出现嵌套 backoff
- [x] 4.2 制定压测检查清单（本地/Redis/线上），验证尾延迟与吞吐变化
