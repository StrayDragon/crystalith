# c23 design — Studio 两阶段 + Analysis 聚类

## Studio 两阶段（移植 v1 generator.py + api.py）

v1 两阶段，各有独立 SSE + LLM 调用：

1. **outline**: `SlideOutline{title, slides:[{title, bullets[]}]}` — AI 生成大纲
2. **markdown**: `SlideMarkdown{markdown}` — 基于 outline 生成完整 Slidev markdown

v2 当前直接出 markdown（stage:outline 是空标签）。修复：

```ts
// studio/router.ts — /generate 拆两步
// 1. POST /slides/:id/outline → generateObject(SlideOutlineSchema) → 存 outline JSON, stage=outline
// 2. POST /slides/:id/markdown → 读 outline → streamText 生成 markdown → 存 markdown, stage=markdown
// 用户可在 outline 后 review/修改再生成 markdown（HITL）
```

## 主题预设（移植 v1 config.py:60-195）

6 预设：minimal-clean/business-brief/product-launch/research-paper/data-insight/creative-visual。
每个含：font/background/transition YAML。frontmatter 由预设确定性重建（LLM 的 frontmatter 被 strip）。

```ts
// theme-presets.ts
const THEME_PRESETS = {
  'minimal-clean': { theme: 'seriph', font: 'Inter', ... },
  'business-brief': { theme: 'apple-basic', ... },
  // ...
};
export function buildFrontmatter(preset: string): string { /* 确定性 YAML */ }
```

## crystalith-slidev 包补全

当前 `packages/crystalith-slidev/` git 0 文件。补：

```
packages/crystalith-slidev/
├── package.json
└── src/
    └── index.ts   # 导出 Slidev 渲染/预览辅助（前端 import 用）
```

最小实现：导出类型 + 占位渲染函数（前端构建不断即可，完整 Slidev 集成留后续）。

## Analysis embedding 聚类（移植 v1 clustering.py:120）

v1 greedy incremental centroid：

```
for each entry (sorted by chunk_id):
  找最相似的现有 cluster centroid（cosine ≥ 0.7）
  若找到 → 加入该 cluster，更新 centroid（running mean）
  否则 → 新建 cluster（max 10）
topic name = top-3 keywords (TF, 去停用词, ≥3 字符)
```

v2 用 c16 修复后的 embedding（距离→相似度）实现：

```ts
// analysis/clustering.ts
export function clusterTopics(entries: VectorEntry[], minSimilarity = 0.7, maxTopics = 10): Topic[];
```

## 相关性 + 矛盾检测（移植 v1 correlation.py + contradiction.py）

- 相关性：每 entry vector search top_k=20（排除自身 source），去重 pair，cap 200，type="similar"
- 矛盾：取 similar 排序前 12，LLM pairwise 判断 yes/no（并发 5），type="contradicts"

## 验证

- studio/analysis BDD
- 单元测试：聚类（相似 entry 归同簇）、矛盾检测（mock LLM）、两阶段 outline→markdown
