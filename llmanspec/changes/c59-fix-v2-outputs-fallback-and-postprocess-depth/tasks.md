# c59 Tasks

## 1. P1-A: fallback 标题用 prompt

- [ ] 1.1 `pipeline.ts`: `generateFallbackContent` 签名加 `prompt` 参数
- [ ] 1.2 标题/问题字段用 `prompt`（截断 200 字符），不再用 `error.message.slice(0,80)`
- [ ] 1.3 所有调用点传入 `prompt`

## 2. P1-B: postprocess 嵌套回填

- [ ] 2.1 `pipeline.ts`: 重写 `ensureMinimumContentFields` → `ensureMinimumContent`，per-type 嵌套回填
- [ ] 2.2 GUIDE: objective `{text, citations:[1]}` + key_points `[{text, citations:[1]}]`
- [ ] 2.3 MINDMAP: root.citations `[1]` + 合成 child `{label, citations:[1], children:[]}`
- [ ] 2.4 BRIEFING: points `[{text, citations:[1]}]`
- [ ] 2.5 PARAGRAPH: citations `[1]`
- [ ] 2.6 FAQ/TIMELINE/QUIZ: 数组项补 `{citations:[1]}`

## 3. P1-C: _postprocessed 无条件设

- [ ] 3.1 `pipeline.ts`: postprocess 末尾无条件 `content._postprocessed = true`（移除 `if (warnings.length > 0)` 条件）

## 4. 测试

- [ ] 4.1 `test/outputs/fallback-title.test.ts`: fallback 标题含 prompt 文本，不含 error.message
- [ ] 4.2 `test/outputs/nested-backfill.test.ts`: per-type 回填结构验证
- [ ] 4.3 `test/outputs/postprocessed-flag.test.ts`: 成功生成后 _postprocessed 恒 true（即使无 warnings）

## 5. spec + 验证

- [ ] 5.1 `llman sdd validate c59-fix-v2-outputs-fallback-and-postprocess-depth` 通过
- [ ] 5.2 `bun test` (server) 通过
- [ ] 5.3 `bun typecheck` (server) ✅
- [ ] 5.4 `bun oxlint` 0 error
