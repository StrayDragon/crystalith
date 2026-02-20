## Context

当前生成链路的优化（tuning、multi-query、缓存、并发限制、模型切换）主要依赖手动验证与局部单测。虽然已有日志字段与部分回归测试，但缺少一个统一的“评测入口”来在固定输入集上重复执行并生成可对比的报告。

评测工具需要满足：
- 可在无外网/无真实模型调用的情况下跑通（使用 test provider 或 stub）
- 可在需要时切换到真实模型进行对比（可选、可控）
- 输出机器可读结果（JSON），便于基线对比与 CI 集成

## Goals / Non-Goals

**Goals:**
- 提供一个离线/半离线的评测 runner：覆盖多个 OutputType、preference、multi-query 场景。
- 定义样例数据格式（输入/期望的最小约束），并生成评测报告（含汇总指标与分项详情）。
- 与现有日志/计时字段对齐（query_count、embed/search/generate timings 等）。
- 初期以“非阻塞 CI”运行：生成报告供人查看，不立即 hard-fail。

**Non-Goals:**
- 不做复杂的语义评分或人工标注评价（先做结构/稳定性/性能类指标）。
- 不把评测 runner 变成运行时服务（先以脚本/CLI 形式提供）。

## Decisions

### 1) 评测 runner 以脚本/CLI 形式提供

位置建议：`backend/py/scripts/` 下新增评测脚本（例如 `llm_eval.py`），可在 `uv run python ...` 下运行。

理由：易于本地与 CI 复用，不影响运行时路径。

### 2) 定义轻量样例数据格式

样例至少包含：
- notebook/source 的构建方式（可用内置 fixture 或直接使用 in-memory vectors）
- prompt、output_type、preference、（可选）model_id
- 最小期望约束：例如“非 fallback”、“citations 非空且索引合法”、“输出字段存在”等

理由：保持可维护性与可扩展性，避免引入大量手工标注成本。

### 3) 报告指标以“结构正确性 + 稳定性 + 性能”优先

建议输出：
- schema pass / fallback / repair 发生率
- citations 合法性（可映射、非空、无越界）
- query_count、embed_ms/search_ms/generate_ms/total_ms（分位数）

理由：这些指标与当前优化方向高度相关，且可自动化回归。

### 4) CI 集成先非阻塞

先在 CI 中运行评测并产出 artifact（JSON/Markdown summary），不作为强制 gate；稳定后再逐步收紧阈值。

## Risks / Trade-offs

- [评测与真实用户行为存在差异] → 评测定位为“回归保护网”，不是最终质量评判；仍需结合线上日志。
- [真实模型评测成本高] → 默认使用 stub/test model；真实模型仅用于对比实验或按需执行。

## Migration Plan

- 首先落地 runner + 样例格式 + 报告输出。
- 增加少量代表性样例，覆盖最常见的 OutputType。
- 随着优化推进逐步扩充样例集与指标阈值。

## Open Questions

- 样例数据是否需要纳入仓库（小规模）还是只在本地/私有环境维护？
- CI 的基线对比策略：固定阈值 vs 与上一次基线 diff？
