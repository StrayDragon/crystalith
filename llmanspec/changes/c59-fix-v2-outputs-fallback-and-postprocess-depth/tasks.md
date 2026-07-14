# c59 Tasks

## 1. P1-A: fallback 标题用 prompt

- [x] 1.1 `pipeline.ts`: `generateFallbackContent` 签名加 `prompt` 参数
- [x] 1.2 标题/问题字段用 `prompt`（截断 200 字符），不再用 `error.message.slice(0,80)`
- [x] 1.3 所有调用点传入 `input.prompt`

## 2. P1-B: postprocess 嵌套回填

- [x] 2.1 `pipeline.ts`: 重写 `ensureMinimumContentFields`，per-type 嵌套回填
- [x] 2.2 GUIDE: objective `{text, citations:[1]}` + key_points `[{text, citations:[1]}]`
- [x] 2.3 MINDMAP: root.citations `[1]` + 合成 child `{label, citations:[1], children:[]}`
- [x] 2.4 BRIEFING: points `[{text, citations:[1]}]`
- [x] 2.5 PARAGRAPH: citations `[1]`
- [x] 2.6 FAQ/TIMELINE/QUIZ/BULLETS: 数组项补 `{citations:[1]}`

## 3. P1-C: _postprocessed 无条件设

- [x] 3.1 `pipeline.ts`: `markPostprocessed` 无条件设 `_postprocessed:true`（移除 warnings/changed 条件）

## 4. 测试

- [x] 4.1 `test/outputs/c59-fallback-postprocess.test.ts`: fallback 标题用 prompt + 嵌套回填 per-type (10 tests)

## 5. spec + 验证

- [x] 5.1 `llman sdd validate c59-fix-v2-outputs-fallback-and-postprocess-depth` 通过
- [x] 5.2 `bun test` (server) 通过（271 pass / 0 fail）
- [x] 5.3 `bun typecheck` (server) ✅
- [ ] 5.4 `bun oxlint` 0 error
