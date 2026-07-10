# align-v2-qa-pipeline — Tasks

## 1. 确定性检索前置阶段

- [ ] `features/qa/handler.ts`: 新增 `retrieveAndJudge()` 函数，复刻 v1 `run_qa_pipeline` 的 12 步判断
- [ ] `features/qa/handler.ts`: 实现 5 种 no-evidence reason 判定 (no_sources/embedding_empty/no_vector_hits/no_valid_chunks/low_similarity)
- [ ] `features/qa/handler.ts`: 实现 confidence 计算 (0.5*sim + 0.3*coverage + 0.2*citation_ratio)
- [ ] `features/qa/handler.ts`: evidence=false 时短路返回 reason 本地化回答（对齐 v1 api.py:271-281 文案）

## 2. Request/Response shape 对齐

- [ ] `packages/shared/src/schemas/qa.ts`: QaRequest 补 `source_ids?: number[]` + `min_score?: number`
- [ ] `features/qa/handler.ts`: retrieveAndJudge 接受 source_ids，透传到 ragRegistry retrieve 过滤
- [ ] `features/qa/handler.ts`: retrieveAndJudge 接受 min_score (默认 0.2)，做证据门控
- [ ] `features/qa/router.ts`: 非流式 POST /v2/qa 响应补 `confidence` + `evidence` + `no_evidence_reason` 字段

## 3. SSE done 事件补字段

- [ ] `features/qa/stream.ts`: done 事件补 `evidence` (bool) + `context` (stats) + `created_at`
- [ ] 验证: done 事件 shape 对齐 v1 `{citations, evidence, confidence, created_at, context, message_id}`

## 4. Citation 字段补全

- [ ] `features/qa/handler.ts`: resolveCitations 补 page_number + paragraph_index（从 chunk.metadata 提取）
- [ ] `features/qa/handler.ts`: chunk_index 改 1-based (`+ 1`)

## 5. Export 端点

- [ ] `features/qa/router.ts`: 新增 `GET /v2/qa/export?session_id=&message_id=&format=markdown|json`
- [ ] markdown 路径: 复刻 v1 `_format_citation_line` + 三段结构 (question/answer/citations)
- [ ] json 路径: 返回 `{ notebook_id, session_id, message_id, question, answer, citations, sources, exported_at }`
- [ ] Content-Disposition header (markdown)

## 6. Session title 自动生成

- [ ] `features/qa/handler.ts`: 首个问题后设置 session title（对齐 v1 `generate_session_title`）

## Verification

```bash
# 单元测试
cd apps/server && bun test features/qa
# no-evidence 5 reason 覆盖测试
# export markdown + json 测试
# confidence 计算测试

# typecheck
cd apps/server && bun run typecheck

# 行为对拍: 对比 v1 qa/service.py:274-487 每个分支
```
