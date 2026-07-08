# fix-v2-studio-and-analysis — Tasks

## 1. Studio 两阶段 ⚠️（outline→markdown 拆分待实现）

- [ ] `features/studio/router.ts`: 拆 outline（generateObject SlideOutlineSchema）→ markdown（基于 outline streamText）
- [ ] outline 存 DB（stage=outline），markdown 存 DB（stage=markdown）
- [ ] 验证: `bun test test/studio/two-stage.test.ts`（outline 可独立 review 后再 markdown）

## 2. 主题预设 ✅

- [x] 新建 `features/studio/theme-presets.ts`: 6 预设 + buildFrontmatter（确定性 YAML）
- [x] router: generation_config.theme_preset → 选预设，strip LLM frontmatter 后重建
- [x] 验证: `bun test test/studio/theme.test.ts`（6 预设、frontmatter 确定性）

## 3. crystalith-slidev 包 ✅

- [x] `packages/crystalith-slidev/package.json` + `src/index.ts`（导出类型 + 占位渲染）
- [x] 验证: 前端 `@crystalith-slidev` import 不再断（tsconfig 路径解析通过）

## 4. Analysis 聚类 ✅

- [x] 新建 `features/analysis/clustering.ts`: greedy centroid 聚类（TF keyword cosine ≥0.7，max 10）
- [x] topic name = top-3 keywords (TF 去停用词)
- [x] `features/analysis/router.ts`: 用聚类替代 8000 字截断单次 LLM
- [x] 验证: `bun test test/analysis/clustering.test.ts`（相似 entry 归同簇）

## 5. Analysis 相关性 + 矛盾 ✅

- [x] 新建 `features/analysis/correlation.ts`: 去重 pair（TF cosine ≥0.7），cap 200，type="similar"
- [x] 新建 `features/analysis/contradiction.ts`: similar 前 12，LLM pairwise（并发 5），type="contradicts"
- [x] 验证: `bun test test/analysis/relation.test.ts`（相关性 pair、矛盾 mock LLM）

## 6. 整体验证

- [x] `cd apps/server && bun test tests/bdd/`（studio/analysis 域 BDD）
- [x] `cd apps/server && bun test test/analysis/`（clustering/correlation/contradiction 全绿）
- [x] `bun oxlint apps/server/src/features/studio/ apps/server/src/features/analysis/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/          # studio/analysis BDD
bun test test/analysis/      # 18 tests (clustering/correlation/contradiction)
bun oxlint apps/server/src/features/studio/ apps/server/src/features/analysis/
```
