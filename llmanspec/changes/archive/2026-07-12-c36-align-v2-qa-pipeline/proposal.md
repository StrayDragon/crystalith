---
depends_on: [c24-add-v2-pipeline-integration]
batch: all
---

# c36-align-v2-qa-pipeline — QA pipeline v1 行为对齐

## Why

c17 (qa-citations) 标 DONE、c31 (qa-noevidence) 标 DONE，但 2026-07-10 v1↔v2 对拍发现 QA 管线存在多处未落地：

- **no-evidence 分支未执行**: v1 `service.py:274-487` 先跑完整检索，`evidence=False` 时短路返回 5 种 reason 的本地化回答。v2 `qa/handler.ts` 让 LLM 自主决定是否调检索工具，5 个 reason 实际只产出 1 个，无证据时模型自由发挥而非给出标准化"无法回答"。
- **export 端点完全缺失**: v1 `GET .../qa/export` (api.py:613-717) 支持 markdown + json。v2 无此端点。
- **非流式响应缺 confidence/evidence**: v1 `QAResponse` 含 `confidence` + `evidence`。v2 只返回 `{answer, citations, message_id, session_id}`。
- **source_ids 过滤不存在**: v1 按 source_ids 限定检索范围 (service.py:290,362)。v2 `QaRequest` 无 source_ids 字段。
- **min_score 阈值不存在**: v1 用 `min_score`(默认0.2) + `EVIDENCE_THRESHOLD_DEFAULT`(0.2) 做证据门控 (service.py:452-464)。v2 无门控。
- **done SSE 事件缺字段**: v1 `done` 含 `evidence`/`context`(stats)/`created_at`。v2 缺这三项。
- **citation shape 不完整**: v1 Citation 含 `page_number`/`paragraph_index` (service.py:437-438)。v2 `resolveCitations` (handler.ts:168-175) 缺这两个字段。

## What Changes

1. **重构 QA handler 为"先检索后生成"**: 检索先行（对齐 v1 `run_qa_pipeline`），`evidence=false` 时短路返回 reason 对应本地化回答，不进入 LLM 自主决策路径
2. **补全 5 种 no-evidence reason 产出**: `no_sources` / `embedding_empty` / `no_vector_hits` / `no_valid_chunks` / `low_similarity`，每种对应 v1 本地化回答
3. **新增 `GET /v2/qa/export`**: markdown + json 双格式，对齐 v1 `export_qa`
4. **非流式响应补 confidence + evidence 字段**
5. **QaRequest 补 source_ids + min_score 参数**，接入检索过滤
6. **done SSE 事件补 evidence/context/created_at**
7. **citation 补 page_number/paragraph_index**（从 chunk metadata 提取）
8. **chunk_index 对齐 v1 1-based**（当前 0-based）

## Capabilities

- generation-core (spec delta: QA 管线 reason/置信度/证据门控语义)
- workspace-api-contract (spec delta: export 端点 + SSE done 事件形状)
- retrieval-and-cache (spec delta: source_ids 过滤在 QA 路径)

## Impact

- **BREAKING**: QA 流式与非流式响应 shape 变化（新增 confidence/evidence/no_evidence_reason 字段）
- QA 无证据场景行为改变（从模型自由发挥变为标准化回答）
- source_ids/min_score 参数从 request 透传到检索层
