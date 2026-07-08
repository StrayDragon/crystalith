# add-v2-web-extractors — Tasks

## 1. 统一接口

- [x] 新建 `shared/extraction/types.ts`: ExtractedContent + Extractor 接口
- [x] 验证: 类型编译通过

## 2. Readability 抽取器

- [x] 新建 `shared/extraction/readability.ts`: 提取 html.ts 逻辑为独立抽取器 + `<meta>` 元数据
- [x] 验证: `bun test test/extraction/readability.test.ts`（正文 + author/date/language）

## 3. Jina AI 抽取器

- [x] 新建 `shared/extraction/jina.ts`: GET r.jina.ai，解析 H1 title
- [x] 验证: `bun test test/extraction/jina.test.ts`（mock fetch，429 处理）

## 4. Firecrawl 抽取器

- [x] 新建 `shared/extraction/firecrawl.ts`: POST /v2/scrape
- [x] 验证: `bun test test/extraction/firecrawl.test.ts`（mock fetch）

## 5. Factory + Policy

- [x] 新建 `shared/extraction/factory.ts`: fallback 链尝试
- [x] `features/sources/router.ts`: GET/PATCH /notebooks/:id/extractors（policy 读写）
- [x] `features/sources/router.ts`: /from-url 用 ExtractorFactory
- [x] 验证: `bun test test/extraction/factory.test.ts`（fallback 顺序、policy 模式）

## 6. 整体验证

- [x] `cd apps/server && bun test tests/bdd/`（source_connectors 域 BDD）
- [x] `bun oxlint apps/server/src/shared/extraction/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/          # source_connectors BDD
bun oxlint apps/server/src/shared/extraction/
```
