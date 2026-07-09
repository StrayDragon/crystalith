# c21 design — Web 内容抽取器

## 抽取器统一接口

```ts
// shared/extraction/types.ts
interface ExtractedContent {
  title: string;
  content: string; // markdown 或纯文本
  description?: string;
  author?: string;
  publishedDate?: string;
  language?: string;
  extractorUsed: string;
}

interface Extractor {
  name: string;
  isAvailable(config): boolean;
  extract(url: string, config): Promise<ExtractedContent>;
}
```

## jina 抽取器（移植 v1 jina_extractor.py，纯 HTTP）

```ts
// jina.ts
export const jinaExtractor: Extractor = {
  name: 'jina',
  isAvailable: (c) => !!c.raw.extraction?.jina_api_key,
  async extract(url, c) {
    const key = c.raw.extraction.jina_api_key;
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { ...(key && { Authorization: `Bearer ${key}` }), 'X-Return-Format': 'markdown' },
    });
    // 429→rate limit, 402→quota
    const text = await res.text();
    return { title: parseH1(text), content: text, extractorUsed: 'jina' };
  },
};
```

## firecrawl 抽取器（移植 v1 firecrawl_extractor.py，REST）

```ts
// firecrawl.ts — 直接 fetch /v2/scrape，不用 SDK（更少依赖）
const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
});
```

## readability 抽取器（trafilatura 替代）

v2 `parsers/html.ts` 已用 `@mozilla/readability`+`cheerio`。提取为独立抽取器 + 补 `<meta>` 元数据：

```ts
// readability.ts
const doc = new JSDOM(html);
const reader = new Readability(doc.window.document);
const article = reader.parse();
// 元数据：cheerio 扫 <meta name="author">,<meta property="article:published_time">,<html lang>
```

## ExtractorFactory（移植 v1 factory.py）

```ts
// factory.ts
export async function extractUrl(url, config, policy): Promise<ExtractedContent> {
  const order = policy.mode === 'custom' ? policy.extractors : ['readability', 'jina', 'firecrawl'];
  for (const name of order) {
    const ext = extractors[name];
    if (!ext.isAvailable(config)) continue;
    try {
      const result = await ext.extract(url, config);
      if (result.content) return result;
    } catch {
      /* fallback next */
    }
  }
  throw new ExtractionError('all extractors failed');
}
```

## notebook_extractor_policies 接线

```ts
// GET /notebooks/:id/extractors → 返回 policy（mode + enabled extractors）
// PATCH /notebooks/:id/extractors → 更新 mode (inherit_global/custom) + extractors 列表
```

## 验证

- source_connectors BDD
- 单元测试：各抽取器（mock fetch）、factory fallback 顺序、policy 读写
