## Approach

v2 API 使用 Elysia router-first 模式，每个 feature 一个独立的 Elysia 实例，在 server.ts 统一 `.use()`。

### Endpoint Structure (v2 replaces v1 /v1 prefix)

```
/v2/notebooks                              GET list, POST create
/v2/notebooks/:id                          GET, PATCH, DELETE
/v2/notebooks/:nid/sessions                GET list, POST create
/v2/notebooks/:nid/sessions/:sid           PATCH, DELETE
/v2/notebooks/:nid/sessions/:sid/messages  GET list (paginated)
/v2/notebooks/:nid/sources                 GET list
/v2/sources/upload                         POST multipart
/v2/sources/:id                            GET, DELETE
/v2/sources/connectors                     GET list connectors
/v2/sources/connectors/:id/sync            POST trigger sync
```

### PDF Parsing

使用 unpdf（基于 pdf.js，MIT 许可），按页提取文本：

```ts
import { extractText, getDocumentProxy } from 'unpdf';

async function parsePdf(buf: Uint8Array): Promise<PageContent[]> {
  const pdf = await getDocumentProxy(buf);
  const { text: pages } = await extractText(pdf, { mergePages: false });
  return pages.map((pageText, i) => ({
    text: pageText,
    metadata: { page: i + 1 },
  }));
}
```

### HTML Parsing

```ts
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

function parseHtml(html: string): string {
  const dom = new JSDOM(html);
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  return article?.textContent ?? cheerio.load(html)('body').text();
}
```

### Source Ingestion Pipeline

```
file upload → detect mime → select parser → parse → chunk → embed → mark ready
```

状态机: `processing → ready | failed`

### Error Envelope

所有 v2 端点统一错误格式:
```json
{ "error_code": "NOT_FOUND", "message": "...", "details": {} }
```

### Migration note

- API 前缀 /v1 → /v2（BREAKING）
- Pydantic schema → Zod schema
- 前端 `@hey-api/openapi-ts` generated client → eden RPC（渐进迁移）
- PDF/HTML parser 从 Python 包切换到 TS 包，benchmark 已验证文本一致性
