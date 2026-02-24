## Context

- `ask_question` 与 `ask_question_stream` 都需要执行相同的检索与上下文装配：source_ids 归属校验 → query embedding → vector search → chunks/source 装配 → citations/context/evidence/confidence 计算。
- 目前两条路径在实现上重复，导致修改容易分叉，且难以通过单测确保“流式 done 事件”与“非流式 JSON”在关键字段上始终一致。

## Goals / Non-Goals

**Goals:**
- 抽取共享的 retrieval/context 构建管线，让两条端点复用同一实现与同一返回结构。
- 保持外部 API 行为稳定：错误码、citations 顺序、evidence/confidence 语义、SSE 事件形状不变。
- 让一致性可测试：新增测试确保两条端点对同一输入返回一致的 metadata（以流式 done 为准）。

**Non-Goals:**
- 不更改检索策略本身（top_k/min_score/multi-query seeds 的既有语义），除非是为消除分叉而做的纯重构。
- 不改变 LLM 生成提示词与答案文本风格（仅重构共用部分）。

## Decisions

### 1) 引入“retrieval result”统一内部数据结构
**Decision:** 定义一个内部结构（pydantic model 或 dataclass）承载 retrieval 产物与派生元信息，例如：
- 规范化后的 `source_ids`、有效 chunks 列表
- `citations`（稳定顺序）
- `context`（统计/截断信息等）
- `evidence` 与 `confidence`

**Rationale:** 明确两条端点共享的“契约边界”，并让测试对该结构做断言而非对实现细节做断言。

### 2) 将检索与生成解耦
**Decision:** 共享 pipeline 只负责“检索与上下文装配”，不负责“答案生成”；生成部分由两条端点各自实现（一次性生成 vs token stream），但都消费同一 retrieval result。

**Rationale:** 流式与非流式的差异在输出形态，不应导致检索层逻辑重复。

### 3) 错误处理在 pipeline 层统一
**Decision:** source_ids 归属校验、无证据提示等应在 pipeline 中统一产出（或抛出统一异常），端点只做标准 error envelope 的返回。

**Rationale:** 减少端点层分支，避免一条路径漏掉校验或返回不同错误码。

## Risks / Trade-offs

- **[风险]** 重构过程中改变 citations 顺序/内容 → **缓解**：在 tasks 中增加“流式 done vs 非流式 JSON 一致性”回归测试，锁住行为。
- **[风险]** pipeline 抽取后参数列表膨胀（依赖注入复杂） → **缓解**：以一个依赖对象（deps）承载 session/vector_store/embedder/settings，并保持 API 面小而清晰。

## Migration Plan

- 无迁移：纯后端重构 + 回归测试。
- 合并后在 CI 中运行全量 pytest，确保两条端点行为一致。

## Open Questions

- pipeline 的边界是否应放在 `features/qa` 内，还是放入 `shared/retrieval` 以便其他能力复用（例如 refine/research）？
