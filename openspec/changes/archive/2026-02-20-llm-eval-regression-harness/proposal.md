## Why

生成链路的优化（tuning、multi-query、缓存、并发限制、模型切换等）会同时影响质量与延迟，但当前缺少统一的**可回归评测**机制来量化：

- schema 通过率 / fallback 或 repair 发生率
- citation 覆盖与有效性（至少“非空且可映射”）
- multi-query 的真实收益（query_count vs 质量）
- 端到端耗时分位数（p50/p95/p99）与分阶段耗时（embed/search/db/format/generate）

没有评测基线时，调参容易回退或引入隐性退化，尤其在本地模型与线上模型混用时更明显。

## What Changes

- 增加一个离线/半离线的评测与回归工具（脚本/CLI），可对多个 OutputType 在固定输入集上运行生成，并输出机器可读报告（JSON + 汇总表）。
- 定义轻量的评测样例数据格式（sources、prompt、output_type、preference、期望的最小约束），支持在本地与 CI 中运行。
- 产出基础指标：schema pass / fallback / repair、citations 合法性、timings、query_count，并支持保存/对比基线。
- 初期以“非阻塞回归”为主（报告可查看，不立即 hard-fail CI），后续成熟后再引入 gating。

## Capabilities

### New Capabilities
- `llm-evaluation`: 系统 SHALL 提供可回归的生成评测工具与指标输出，用于验证优化与模型切换不会引入质量/性能退化。

### Modified Capabilities
- `backend-performance`: 系统 SHOULD 暴露/记录足够的分阶段 timings 与关键字段，供评测工具与性能回归使用。

## Impact

- Backend
  - `backend/py/scripts/*`：新增评测脚本与报告格式定义。
  - `backend/py/tests/*`：必要时增加“评测工具”自身的单元测试（不引入网络依赖）。
  - `docs/`（可选）：记录如何运行评测、如何读报告、如何对比基线。
- 不改变运行时 API；主要增加开发/CI 工作流能力。
