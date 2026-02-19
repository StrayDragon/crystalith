## 1. Trace model & propagation

- [x] 1.1 定义生成链路最小 trace 字段集合（`trace_id`, `request_id`, `notebook_id`, `output_type`, `preference`, `model_id`）并约定字段命名
- [x] 1.2 在 outputs（OutputGraph）入口生成 `trace_id` 并贯穿 ResolveContext/GenerateOutput/PersistOutput 的关键日志
- [x] 1.3 在 slides outline/markdown 入口生成 `trace_id` 并贯穿 context/生成/持久化的关键日志

## 2. Standardize stage timings

- [x] 2.1 对齐 outputs 与 slides 的阶段耗时字段命名（embed/search/db/format/generate/persist/total）
- [x] 2.2 为失败路径补齐必要耗时与结果字段（例如 `fallback`, `agent_retries`）

## 3. Error classification

- [x] 3.1 定义 `error_kind` 枚举/常量并在生成失败时统一填充
- [ ] 3.2 将 provider/model 相关异常映射到稳定的 `error_kind`（避免日志字段过于离散）

## 4. Optional: slides SSE done timings

- [x] 4.1 增加 debug 开关（配置或环境变量）控制是否在 SSE `done` payload 输出 `timings_ms`
- [x] 4.2 在 debug 开启时为 outline/markdown 的 `done` 事件附带 `timings_ms` 汇总；关闭时不输出

## 5. Verification

- [x] 5.1 添加最小单测：`trace_id` 生成与 `error_kind` 映射函数
- [x] 5.2 添加/更新集成测试：SSE `done` 在 debug 开关开/关时的 payload 差异（如已有测试框架支持）
