## Context

当前 QA API 已把检索/上下文构建下沉到 `run_qa_pipeline`，但在 API 层仍重复实现了：
- 非流式/流式的“无证据回答持久化”
- 有证据回答持久化
- `context`/`done` 元信息组装

## Goals / Non-Goals

**Goals:**
- 抽取共享完成逻辑，减少重复实现。
- 保持现有 API/SSE 输出字段和语义不变。

**Non-Goals:**
- 不修改 `run_qa_pipeline` 的检索逻辑。
- 不调整 prompt、引用策略或置信度算法。

## Decisions

### 1) 共享“完成阶段”辅助函数
**Decision:** 在 `qa/api.py` 新增辅助函数，统一处理：
- context stats 转换
- QA 消息持久化
- non-stream response / stream done payload 构造

**Rationale:** 将重复且易漂移的收尾逻辑集中，减少维护面。

### 2) 保持对外协议稳定
**Decision:** 仅重构内部实现，不改动已有 endpoint path、status code、返回字段。
**Rationale:** 避免引入不必要的前端适配成本。

## Risks / Trade-offs

- **[风险]** 抽取 helper 时参数传递错误导致 response 字段变化 → **缓解**：运行现有 QA API 回归测试覆盖 non-stream + stream done 一致性。
