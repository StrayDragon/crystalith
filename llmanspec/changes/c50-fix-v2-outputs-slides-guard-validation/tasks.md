# fix-v2-outputs-slides-guard-validation — Tasks

## 1. SLIDES 400 守卫 (P1)

- [ ] `features/outputs/router.ts:97-180`: POST handler 入口对 `type=SLIDES` 返回 400 "Use slides endpoints for SLIDES output"（对齐 v1 api.py:205-206）
- [ ] `features/outputs/pipeline.ts`: 移除（不会到达的）SLIDES 处理或保留但不依赖
- [ ] 验证：POST /outputs type=SLIDES → 400；SLIDES 经 studio 端点正常工作

## 2. source_id 校验 (P1)

- [ ] `features/outputs/pipeline.ts` 入口: 校验每个 source_id 属于 notebook（对齐 v1 `_validate_source_ids`, output_graph.py:151-176）
- [ ] 未知/不属于 notebook 的 id → 400 "Unknown source_id in source_ids"
- [ ] 验证：传错误 source_id → 400（而非静默空检索）

## 3. citation sanitize (P1)

- [ ] `features/outputs/pipeline.ts`: 实现 `sanitizeCitationsIndices`（递归剥离越界/重复/非整数 citation 索引），对齐 v1 output_postprocess.py:293-346
- [ ] 设 `_postprocessed: true`（v1 line 377）与 `_warnings`/`citations_sanitized` 标记
- [ ] 在 mapCitationsIntoContent 之后调用 sanitize
- [ ] 验证：越界/重复索引被剥离并标记

## 4. LLM repair loop (P1)

- [ ] `features/outputs/pipeline.ts`: 实现 needs_repair 检测（对齐 v1 output_postprocess.py:192-290）
- [ ] preference=quality 且 needs_repair=true 时跑第二次 LLM pass 修补（对齐 v1 output_graph.py:595-719 PostprocessOutput 节点）
- [ ] 验证：quality 请求下可挽救的输出被 repair 而非直接 fallback

## Verification

```bash
cd apps/server && bun typecheck   # MUST pass
cd apps/server && bun test        # outputs 相关测试 MUST pass，无回归
```

人工：

- SLIDES → 400；studio SLIDES 正常
- 错误 source_id → 400
- 越界 citation 索引被剥离 + _postprocessed 标记
- quality 请求下缺字段输出被 repair
