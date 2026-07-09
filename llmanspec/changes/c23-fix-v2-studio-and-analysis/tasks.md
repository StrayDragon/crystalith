# fix-v2-studio-and-analysis — Tasks

## 1. Studio 两阶段

- [ ] `features/studio/router.ts`: 拆 outline（generateObject SlideOutlineSchema）→ markdown（基于 outline streamText）
- [ ] outline 存 DB（stage=outline），markdown 存 DB（stage=markdown）
- [ ] 验证: `bun test test/studio/two-stage.test.ts`（outline 可独立 review 后再 markdown）

## 2. 主题预设

- [ ] 新建 `features/studio/theme-presets.ts`: 6 预设 + buildFrontmatter（确定性 YAML）
- [ ] router: generation_config.theme_preset → 选预设，strip LLM frontmatter 后重建
- [ ] 验证: `bun test test/studio/theme.test.ts`（6 预设、frontmatter 确定性）

## 3. crystalith-slidev 包补全

- [ ] `packages/crystalith-slidev/package.json` + `src/index.ts`（导出类型 + 占位渲染）
- [ ] 验证: 前端 `@crystalith-slidev` import 不再断（tsconfig 路径解析通过）

## 4. Analysis embedding 聚类

- [ ] 新建 `features/analysis/clustering.ts`: greedy centroid 聚类（cosine ≥0.7，max 10）
- [ ] topic name = top-3 keywords (TF 去停用词)
- [ ] `features/analysis/router.ts`: 用聚类替代 8000 字截断单次 LLM
- [ ] 验证: `bun test test/analysis/clustering.test.ts`（相似 entry 归同簇）

## 5. 相关性 + 矛盾检测

- [ ] 新建 `features/analysis/correlation.ts`: vector search top_k=20 排除自身，去重 pair
- [ ] 新建 `features/analysis/contradiction.ts`: similar 前 12，LLM pairwise（并发 5）
- [ ] 验证: `bun test test/analysis/relation.test.ts`（相关性 pair、矛盾 mock LLM）

## 6. 整体验证

- [ ] `cd apps/server && bun test tests/bdd/`（studio/analysis 域 BDD）
- [ ] `bun oxlint apps/server/src/features/studio/ apps/server/src/features/analysis/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/    # studio/analysis 域
bun test test/studio/ test/analysis/
bun oxlint apps/server/src/features/studio/ apps/server/src/features/analysis/
```
