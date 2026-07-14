---
depends_on: []
batch: all
---

# c59-fix-v2-outputs-fallback-and-postprocess-depth — outputs fallback 标题来源 + postprocess 嵌套回填 + _postprocessed 标记

## Why

2026-07-13 第七轮深度审计发现 outputs 生成管线存在 3 个 P1，集中在 fallback 内容的可见标题来源、postprocess 回填深度、`_postprocessed` 标记契约。c42 已修复 OutputRead 契约/citation 树映射/RAG 失败传播，但这 3 项细节偏差残留。

### 实现违反

1. **P1-A：fallback 用 `error.message` 作可见标题**。v2 `pipeline.ts:385` 的 `generateFallbackContent` 用 `error.message.slice(0,80)` 作为标题/问题文本。v1 `output_postprocess.py:16` 用用户 `prompt`。**v2 用户在生成失败时看到原始异常内部信息（如 "TypeValidationError: ..."），v1 用户看到自己的 prompt**。影响全部 8 种 output type 的 fallback 形状。
2. **P1-B：postprocess 回填过浅**。v2 `ensureMinimumContentFields`（`pipeline.ts:261-310`）只做浅层 `ensureArray`（缺则设 `[]`）。v1 `ensure_minimum_content`（`output_postprocess.py:102-189`）做丰富嵌套回填：GUIDE 回填 `objective:{text,citations:[1]}` + `key_points:[{text,citations:[1]}]`；MINDMAP 回填 `root.citations=[1]` + 合成 child `{label,citations:[1],children:[]}`；BRIEFING 回填 `points:[{text,citations:[1]}]`；PARAGRAPH 回填 `citations:[1]`。v2 回填不足导致更多不完整内容依赖 fallback/repair。
3. **P1-C：`_postprocessed` 标记条件设**。v2 `pipeline.ts:615-616` 仅在 `warnings.length > 0` 时设 `_postprocessed:true`。v1 `output_postprocess.py:377` **无条件**设 `_postprocessed:true`。下游消费者（如前端检查此 flag 决定是否展示"已后处理"标识）会看到不一致值。

### v1 参考（正确行为）

- `backend/py/.../shared/agents/output_postprocess.py:15-99` —— `_fallback_output(prompt, output_type)` 用 prompt 作标题。
- `backend/py/.../shared/agents/output_postprocess.py:102-189` —— `ensure_minimum_content` 嵌套回填（per-type）。
- `backend/py/.../shared/agents/output_postprocess.py:377` —— 无条件 `_postprocessed = True`。

## What Changes

1. **`apps/server/src/features/outputs/pipeline.ts`** —— `generateFallbackContent` 签名加 `prompt` 参数，用 `prompt`（截断）作标题/问题文本，不再用 `error.message`。
2. **`apps/server/src/features/outputs/pipeline.ts`** —— `ensureMinimumContentFields` 改为 `ensureMinimumContent`（移植 v1 嵌套回填逻辑）：per-type 回填 `{text, citations:[1]}` 结构（GUIDE objective/key_points、MINDMAP root+child、BRIEFING points、PARAGRAPH citations）。
3. **`apps/server/src/features/outputs/pipeline.ts`** —— postprocess 末尾无条件设 `_postprocessed:true`（不论 warnings 是否为空）。
4. **测试** —— fallback 标题用 prompt 测试 + 嵌套回填 per-type 测试 + `_postprocessed` 恒 true 测试。

## Capabilities

- `generation-core` —— ADDED `outputs-fallback-title-from-prompt`（fallback MUST 用 prompt 作标题）+ ADDED `outputs-postprocess-nested-backfill`（postprocess MUST 嵌套回填 per-type）+ ADDED `outputs-postprocessed-flag-always-set`（`_postprocessed` MUST 无条件设）

## Impact

- **无 BREAKING**（内部生成管线修正；fallback 内容改善对用户可见但非契约变化）。
- **用户可见改进**：生成失败时 fallback 显示用户 prompt 而非异常文本；不完整内容得到嵌套回填；`_postprocessed` flag 一致。
- **风险**：低。fallback 标题改 + 嵌套回填 + 标记无条件设，均为纯增量行为修正。
- **依赖**：独立于 c57/c58/c60–c62；不阻塞 c13/c14。
