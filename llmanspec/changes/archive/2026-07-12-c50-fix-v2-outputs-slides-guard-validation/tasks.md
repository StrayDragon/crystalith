# fix-v2-outputs-slides-guard-validation — Tasks

## 1. SLIDES 400 守卫 (P1)

- [x] `features/outputs/router.ts`: POST handler 入口对 `type=SLIDES` 返回 400 "Use slides endpoints for SLIDES output"（对齐 v1 api.py:205-206），error_code=OUTPUT_TYPE_USE_STUDIO
- [x] 验证：POST /outputs type=SLIDES → 400；SLIDES 经 studio 端点正常工作

## 2. source_id 校验 (P1)

- [x] `features/outputs/pipeline.ts` runOutputPipeline 入口: 校验每个 source_id 属于 notebook（对齐 v1 `_validate_source_ids`, output_graph.py:151-176）
- [x] 未知/不属于 notebook 的 id → 抛 "Output retrieval failed: Unknown source_id..."（router 的 msg.includes('retrieval') → 400）
- [x] 验证：传错误 source_id → 400（而非静默空检索）

## 3. citation sanitize (P1)

- [x] `features/outputs/pipeline.ts`: 实现 `sanitizeCitationsIndices`（递归剥离越界/重复/非整数 citation 索引），对齐 v1 output_postprocess.py:293-346
- [x] `sanitizeCitationList`（v1 `_sanitize_citation_list` 单列表清理）
- [x] sanitize 在 mapCitationsIntoContent 之前执行（清理原始 numeric 数组，再 resolve）
- [x] `markPostprocessed`: 设 `_postprocessed: true` + `_warnings`（v1 line 377）
- [x] 验证：越界/重复索引被剥离 + _postprocessed 标记

## 4. LLM repair loop (P1)

- [x] `features/outputs/pipeline.ts`: 实现 `needsRepair`（对齐 v1 output_postprocess.py:192-290）：检测空/缺关键字段、_fallback 不修
- [x] preference=quality 且 needsRepair=true 时跑第二次 generateOutputByType pass（对齐 v1 output_graph.py:595-719 PostprocessOutput 节点）
- [x] repair 成功（!needsRepair）则接受 repaired；repair 失败则保留原 object（postprocess 会 fallback）
- [x] 验证：quality 请求下可挽救的输出被 repair 而非直接 fallback

## Verification

```bash
cd apps/server && bun typecheck   # ✅ pass
cd apps/server && bun test        # ✅ 209 pass / 2 fail（research 网络 + URL 超时，非回归，与基线一致）
```

人工：
- SLIDES → 400；studio SLIDES 正常
- 错误 source_id → 400
- 越界 citation 索引被剥离 + _postprocessed 标记
- quality 请求下缺字段输出被 repair
