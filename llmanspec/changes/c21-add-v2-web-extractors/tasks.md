# add-v2-web-extractors — Tasks

## 1. 抽取器统一接口

- [ ] 新建 `shared/extraction/types.ts`: ExtractedContent + Extractor 接口
- [ ] 验证: 类型编译通过

## 2. readability 抽取器（trafilatura 替代）

- [ ] 新建 `shared/extraction/readability.ts`: 提取 html.ts 逻辑为独立抽取器 + `<meta>` 元数据
- [ ] 验证: `bun test test/extraction/readability.test.ts`（正文 + author/date/language）

## 3. jina 抽取器

- [ ] 新建 `shared/extraction/jina.ts`: GET r.jina.ai，解析 H1 title
- [ ] 验证: `bun test test/extraction/jina.test.ts`（mock fetch，429 处理）

## 4. firecrawl 抽取器

- [ ] 新建 `shared/extraction/firecrawl.ts`: POST /v2/scrape
- [ ] 验证: `bun test test/extraction/firecrawl.test.ts`（mock fetch）

## 5. ExtractorFactory + policy

- [ ] 新建 `shared/extraction/factory.ts`: fallback 链尝试
- [ ] `features/sources/router.ts`: GET/PATCH /notebooks/:id/extractors（policy 读写）
- [ ] `features/sources/router.ts`: /from-url 用 ExtractorFactory
- [ ] 验证: `bun test test/extraction/factory.test.ts`（fallback 顺序、policy 模式）

## 6. 整体验证

- [ ] `cd apps/server && bun test tests/bdd/`（source_connectors 域 BDD）
- [ ] `bun oxlint apps/server/src/shared/extraction/`（0 error）

## Verification

```bash
cd apps/server
bun test tests/bdd/    # source_connectors 域
bun test test/extraction/
bun oxlint apps/server/src/shared/extraction/
```
