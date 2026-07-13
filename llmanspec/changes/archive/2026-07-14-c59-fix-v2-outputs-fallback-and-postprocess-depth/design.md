# c59 Design — outputs fallback 标题 + postprocess 嵌套回填 + _postprocessed 标记

> SSOT: `backend/py/src/crystalith/shared/agents/output_postprocess.py`

## 决策

### D1: fallback 标题来源——prompt 而非 error.message

`generateFallbackContent(prompt, outputType, error?)` 签名改为接收 `prompt`。标题/问题字段用 `prompt`（截断到合理长度，如 200 字符）。`error` 仅用于日志，不进入用户可见内容。对齐 v1 `_fallback_output(prompt, output_type)`。

### D2: 嵌套回填 per-type——移植 ensure_minimum_content

v1 `ensure_minimum_content`（output_postprocess.py:102-189）per-type 回填：

- **GUIDE**: `objective = {text: prompt, citations:[1]}`（若缺）；`key_points = [{text:"...", citations:[1]}]`（若空）
- **MINDMAP**: `root.citations = [1]`（若缺）；若 `root.children` 空，合成 `{label: prompt, citations:[1], children:[]}`
- **BRIEFING**: `points = [{text:"...", citations:[1]}]`（若空）
- **PARAGRAPH**: `citations = [1]`（若缺）
- **FAQ/TIMELINE/QUIZ**: 数组项补 `{citations:[1]}`（若缺）

v2 `ensureMinimumContent` 实现此 per-type 逻辑，替换当前浅层 `ensureArray`。

### D3: _postprocessed 无条件设

postprocess 函数末尾（return 前）无条件 `content._postprocessed = true`，不论 warnings 数组是否为空。对齐 v1 output_postprocess.py:377。

## 涉及文件

### 修改

- `apps/server/src/features/outputs/pipeline.ts` —— generateFallbackContent 签名 + ensureMinimumContent 嵌套回填 + _postprocessed 无条件设

### 新增测试

- `apps/server/test/outputs/fallback-title.test.ts` —— fallback 标题含 prompt 文本
- `apps/server/test/outputs/nested-backfill.test.ts` —— per-type 回填结构（GUIDE/MINDMAP/BRIEFING/PARAGRAPH）
- `apps/server/test/outputs/postprocessed-flag.test.ts` —— 成功生成后 _postprocessed 恒 true
