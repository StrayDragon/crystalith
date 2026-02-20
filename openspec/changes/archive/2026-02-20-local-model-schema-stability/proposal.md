## Why

本地小模型（例如 Ollama + qwen2.5-coder:1.5b）在结构化输出（BULLETS/STRUCTURED 等）场景下更容易出现 JSON/schema 偏差，导致生成阶段直接触发 schema 校验失败并回退到 fallback 输出。该行为显著降低用户体验，也增加了“必须换强模型才能用”的摩擦。

## What Changes

- 让核心结构化输出 schema 对常见的 LLM 偏差更宽容（例如：额外字段、citations 为字符串、items/bullets 列表元素为字符串等），减少“几乎正确但仍被拒绝”的失败率
- 保持对外输出结构不变：仍然经由 postprocess（最低内容兜底、citations 清洗、internal key 处理）输出稳定字段
- 增加回归测试：覆盖宽容解析的关键输入形态，防止未来回退

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `agent-architecture`: 输出生成工作流（OutputGraph）对结构化输出的解析/校验策略从“严格拒绝”调整为“宽容解析 + 后处理归一化”，以提升本地模型可用性

## Impact

- Backend：`shared/agents/output_schemas.py` 的 schema 校验策略将更宽容；输出生成路径的回退概率降低
- Tests：新增/扩展单测覆盖宽容解析输入
- 无需更改 API 形状；无 DB 迁移；不影响前端 API client 生成
