# revert-refine-to-v1-citation-aware-rag — Tasks

## Phase 1: Schema + 共享层

- [ ] 更新 packages/shared/src/schemas/refine.ts: RefineRequestSchema 字段改为 prompt(min1)/format(paragraph/bullets/structured)/source_ids/top_k(1-20)/min_score(0-1); RefineResultSchema 改为 format/paragraph?/bullets?/structured?{title,bullets,terms,citations}/citations/evidence/created_at; 新增 RefineBatchRequestSchema(formats?)/RefineBatchResponseSchema(outputs{format:output})
- [ ] 新建 apps/server/src/features/refine/format.ts: FORMAT_PROMPTS(完整原文含 structured 的 type hints) + buildRefineMessages(system+user) + applyFormat(paragraph.trim/bullets.parseBullets/structured 显式构造非 spread + fallback) + parseBullets(逐行 strip+lstrip("-")+strip 仅保留非空) + fallbackStructured(prompt.trim().slice(0,48) bullets=citations[:5].snippet) + extractPageNumber(metadata.page) + extractParagraphIndex(metadata.paragraph_index)
- [ ] 新建 apps/server/src/features/refine/retrieve.ts: retrieveForRefine — 无 source_ids 早返回空; embedding limiter + ragRegistry.get('embed').retrieve(over-fetch topK*sourceIds.length); 后过滤 source_ids 截到 topK; hydrate chunk.text+source.filename; citations(strip+slice200+page/paragraph); context([N] Source: filename (chunk idx)\nfull text, \n\n join)

## Phase 2: Worker + Router 重写

- [ ] 重写 apps/server/src/features/tasks/worker.ts 的 handleRefine: prompt.trim() 空校验; retrieveForRefine; llm_generate limiter + generateText; applyFormat; 返回 {format,...applyFormat,citations,evidence,created_at:ISO}
- [ ] 重写 apps/server/src/features/refine/router.ts POST /refine: notebook 404 校验; format 校验 400; source_ids 校验(normalize dedup + int cast + >0 check + DB存在性 → 400); 入队; waitForCompletion catch → 409 cancel / 500 fail
- [ ] 新增 apps/server/src/features/refine/router.ts POST /refine/batch: 校验同上; formats null 默认 3 格式; retrieveForRefine 一次; Semaphore(3) 并发 generateText+applyFormat; 返回 {outputs,citations,evidence,created_at}
- [ ] 改 GET /refine/modes 返回 paragraph/bullets/structured(含中文 display_name)

## Phase 3: 测试

- [ ] 更新 apps/server/test/refine/queue.test.ts: 请求 {prompt,format,source_ids}; 响应断言 format/citations/evidence; 无 source_ids → evidence=false; cancel → 409
- [ ] 新增 apps/server/test/refine/citation-aware.test.ts: seed notebook+source+chunk → refine → 断言 citations 非空 + evidence=true + snippet strip 生效
- [ ] 新增 apps/server/test/refine/batch.test.ts: batch 3 格式 → 断言 outputs 3 key + 共享 citations + formats null 默认全部
- [ ] 新增 apps/server/test/refine/parse-bullets.test.ts: parseBullets 逐行 strip+lstrip("-") 行为; 空行跳过; 对照 v1 utils/text.py

## Phase 4: 验证

- [ ] cd apps/server 执行 bun test 全量绿(含更新后的 refine 测试)
- [ ] cd apps/server 执行 bun typecheck clean
- [ ] cd apps/server 执行 bun test tests/bdd 21 pass 不回归

## 前置条件

c16(RAG foundations) + c24(WS-A storage + worker dispatch) 已完成。本 change 在此基础上回退 refine。

## 对照 v1 参考

- backend/py/src/crystalith/features/refine/api.py(321 行) — 端点 + FORMAT_PROMPTS + _apply_format + batch 并发 + 校验
- backend/py/src/crystalith/features/tasks/worker.py:154-264 — _execute_refine(检索 + citations + context + LLM)
- backend/py/src/crystalith/shared/utils/text.py:23-30 — parse_bullets(逐行 strip + lstrip("-"))
- backend/py/src/crystalith/shared/utils/context.py:13-24 — format_context([N] Source: filename (chunk idx)\ntext)
- backend/py/src/crystalith/shared/utils/chunk.py — extract_page_number/extract_paragraph_index
- backend/py/src/crystalith/shared/config/models.py:525-527 — RefineSettings.formats 默认值

## Verification

```bash
cd apps/server
bun test
bun test test/refine/
bun typecheck
```
