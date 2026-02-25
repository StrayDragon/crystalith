## Why

当前 `ask_question`（非流式）与 `ask_question_stream`（SSE 流式）在同一文件内重复实现了大段检索与上下文构建逻辑（来源范围校验、向量检索、chunk/source 校验、citations 组装、context stats/confidence 计算等）。

这种重复会带来两类问题：

- **行为分叉风险**：修复/调参容易只改到其中一条路径，导致同一问题在流式与非流式返回不同 citations/evidence/confidence。
- **维护成本高**：重复代码增加修改面，降低可读性与可测试性。

需要抽取共享的“检索→上下文→引用”管线，并让两条端点共享同一实现，确保最终结果一致。

## What Changes

- 抽取一个可复用的 QA pipeline 服务（例如 `build_qa_context(...)` / `run_retrieval_pipeline(...)`），统一完成：
  - notebook/source_ids 归属校验与错误返回
  - query embedding、vector search、多 query seeds（如有）
  - chunks/source 装配与 citations 生成
  - evidence/confidence/context 元信息计算
- `ask_question` 与 `ask_question_stream` 仅负责各自的“响应形态”（一次性 JSON vs SSE 事件流），但共享上述 pipeline 的输入与输出结构。
- 增加回归测试：同一输入在两条端点上产生一致的 `citations/evidence/confidence/context`（流式以 done 事件为准）。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `rag-qa`: 约束流式与非流式 QA 的检索与引用构建行为保持一致，避免实现分叉。

## Impact

- 受影响代码（预计）：
  - `backend/py/src/crystalith/features/qa/api.py`
  - 新增/调整 `backend/py/src/crystalith/features/qa/service.py`（或 shared/retrieval 层 helper）
  - 相关 pytest 覆盖（QA 与 SSE）
- 风险：
  - 需要谨慎保持外部 API 行为不变（特别是错误码、done 事件字段与 citations 顺序）。
