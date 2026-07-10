# c36 Design — QA pipeline v1 行为对齐

## v1 行为契约 (SSOT: `backend/py/.../qa/service.py:274-487`)

v1 QA 是**确定性检索 + 条件生成**两段式管线，不是 agent tool-call：

```
run_qa_pipeline():
  1. normalize + validate source_ids
  2. if no source_ids → evidence=False, reason="no_sources"
  3. embed question
  4. if embedding empty → evidence=False, reason="embedding_empty"
  5. vector_search(notebook, query, top_k, min_score, source_ids)
  6. if no hits → evidence=False, reason="no_vector_hits"
  7. filter: source.status==READY, chunk non-empty → valid_results
  8. if no valid → evidence=False, reason="no_valid_chunks"
  9. format context, build context window (token budget)
 10. if similarity_avg < max(min_score, 0.2) → evidence=False, reason="low_similarity"
 11. compute confidence(similarity_avg, coverage_ratio, citation_ratio)
 12. evidence=True → enter LLM generation with context + citations
```

5 种 reason 对应的本地化回答（api.py:271-281, 419-449）：无 sources / 向量库空 / 无命中 / 无有效 chunk / 相似度过低。

## v2 当前问题

v2 `qa/handler.ts` 用 AI SDK agent tool-call 模式：LLM 自主决定是否调 `retrieveSources`。后果：

- no-evidence 分支不会短路（模型可能在无证据时编造回答）
- reason 只在事后推断，且只产出部分
- confidence/evidence/context_stats 从不计算

## v2 对齐方案

**保留 AI SDK streamText 作为生成层，但在前面加确定性检索前置阶段。** 不把整个管线退回确定性——v2 的 streamText 流式体验是改进，但检索判断必须是确定性的。

```
v2 handler 新流程:
  1. [确定性] retrieveAndJudge(req) → { evidence, reason?, citations, context, confidence, stats }
     - 完整复刻 v1 的 12 步判断
     - 调 ragRegistry embed retrieve
  2. if !evidence → 短路返回 reason 本地化回答 (stream chunk + done)
  3. if evidence → streamText({ messages, context, citations }) 现有生成路径
```

## confidence 计算 (对齐 v1 `confidence_score`)

```ts
// v1: similarity_avg, coverage_ratio (unique_sources/total_sources), citation_ratio (min(1, n/top_k))
confidence = 0.5 * similarity_avg + 0.3 * coverage_ratio + 0.2 * citation_ratio;
```

## citation 字段补全

v1 Citation: `{ source_id, source_name, chunk_id, chunk_index(1-based), page_number, paragraph_index, snippet, score }`
v2 当前缺 page_number/paragraph_index → 从 `chunk.metadata` 提取（pipeline.ts 已存这些字段）。
chunk_index 从 0-based 改 1-based（`+ 1`）。

## export 端点

`GET /v2/qa/export?session_id=&message_id=&format=markdown|json`

- markdown: 复刻 v1 `_format_citation_line` + 头部元信息 + question/answer/citations 三段
- json: `{ notebook_id, session_id, message_id, question, answer, citations, sources, exported_at }`
- Content-Disposition: `attachment; filename="qa-export-{message_id}.md"`

## 不做的事

- 不改 streamText 的 token-by-token 流式机制（v2 改进保留）
- 不改 QA 的 AI SDK tool 定义（只在确定性前置阶段后调用）
- 不引入 v1 的 context_window 优先级排序（那是 c40 shared 基础设施的范围）
