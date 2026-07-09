---
depends_on: [c18-add-v2-source-dedup-and-safety]
blocks: [c13-add-v2-distribution, c14-add-v2-cleanup-delivery]
batch: all
---

# c21-add-v2-web-extractors — Web 内容抽取器

## Why

`docs/V1-V2-DRIFT-ANALYSIS.md` 揭示 v2 缺失 v1 的整个 extractor 策略子系统：v1 有 4 个 web 抽取器（trafilatura/jina/firecrawl/browserless）+ `ExtractorFactory` fallback 链 + `notebook_extractor_policies` 表（inherit_global/custom 模式）。v2 的 `notebook_extractor_policies` 表存在但**从未读写**，无 `/extractors` 路由，URL 导入只用本地 Readability。

库适配结论：trafilatura（C/Python）**无 JS 等价**，用 `@mozilla/readability`+`cheerio`（v2 已装）替代；jina/firecrawl 是纯 HTTP API，移植 trivial；browserless v1 也未真正实现，v2 不实现。

## What Changes

- **NEW** `apps/server/src/shared/extraction/jina.ts` — jina 抽取器（`GET https://r.jina.ai/{url}`，纯 fetch，~40 行）
- **NEW** `apps/server/src/shared/extraction/firecrawl.ts` — firecrawl 抽取器（fetch `/v2/scrape`，或 firecrawl-sdk）
- **NEW** `apps/server/src/shared/extraction/readability.ts` — 本地 Readability+cheerio 抽取（已有 html.ts 逻辑，提取为独立抽取器）+ `<meta>` 标签元数据（author/date/language）
- **NEW** `apps/server/src/shared/extraction/factory.ts` — ExtractorFactory：按 fallback 顺序尝试，首个非空返回
- **MODIFIED** `apps/server/src/features/sources/router.ts` — 接线 `notebook_extractor_policies`：GET/PATCH `/notebooks/:id/extractors`，inherit_global/custom 模式
- **MODIFIED** `apps/server/src/features/sources/router.ts` — `/from-url` 用 ExtractorFactory（经 c18 SSRF 守卫）

## Capabilities

- web-extractor-plugins (spec delta: jina/firecrawl/readability + policy)

## Impact

- URL 导入支持多抽取器 fallback（readability→jina→firecrawl）
- per-notebook 抽取器策略配置可用
- `notebook_extractor_policies` 表接线（不再死表）
