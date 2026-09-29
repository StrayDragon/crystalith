// c123 — ingestion parser defects:
//   r257 — deterministic parser selection + parserType recorded on the row
//   r258 — core profile: txt/md/markdown/csv supported, others rejected
//   r295 — unsupported formats → 415 with machine-readable diagnostics
//   r287/r464/r465 — markdown preprocessing (wikilinks, embeds, frontmatter)
//   r52 (rewritten) — raw bytes persisted and readable back via contentStorage
//
// Self-contained per the --parallel isolation discipline: the 'ai' module mock
// is installed BEFORE importing server modules (ingest embeds synchronously).
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('ai', () => {
  const MOCK_VECTOR = Array.from({ length: 1024 }, () => 0.01);
  return {
    Output: { object: <T>(spec: T) => spec },
    generateObject: async () => ({ object: {} }),
    generateText: async () => ({ text: 'mocked' }),
    streamText: () => {
      const parts = (async function* () {
        yield { type: 'text-delta', text: 'mocked' };
      })();
      return { stream: parts, fullStream: parts, textStream: parts };
    },
    embed: async () => ({ embedding: MOCK_VECTOR }),
    embedMany: async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => MOCK_VECTOR),
    }),
    tool: (def: unknown) => def,
    ToolLoopAgent: class {
      async generate() {
        return { text: 'mocked' };
      }
    },
    isStepCount: () => ({ stopWhen: 'stepCount' }),
    // embedder wraps the resolved model with retry middleware
    wrapLanguageModel: ({ model }: { model: unknown }) => model,
  };
});

// EmbedStrategy consumes the embedder directly — stub it hermetically
// (1024-dim zero vectors match DEFAULT_EMBEDDING_DIM).
mock.module('../../src/rag/embedder.ts', () => ({
  getEmbedModel: async () => null,
  embedSingle: async () => new Float32Array(1024),
  embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(1024)),
}));

import { eq } from 'drizzle-orm';

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { preprocessMarkdown } from '../../src/features/sources/markdown-preprocess.ts';
import { ingestSource } from '../../src/features/sources/pipeline.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { contentStorage } from '../../src/shared/storage.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const enc = (s: string) => new TextEncoder().encode(s);
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  resetConfig({
    models: {
      defaults: { chat: 'test-chat', embedding: 'test-embed' },
      available: [
        {
          id: 'test-chat',
          provider: 'openai',
          model: 'gpt-4o-test',
          displayName: 'Test Chat',
          roles: ['chat'],
          capabilities: [],
          providerConfig: { apiKey: 'test-key' },
        },
        {
          id: 'test-embed',
          provider: 'openai',
          model: 'bge-m3-test',
          displayName: 'Test Embed',
          roles: ['embed'],
          capabilities: [],
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });
  notebookId = getOrm().insert(notebooks).values({ name: 'parser-sel' }).returning().get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('r257 deterministic parser selection', () => {
  it('selects the registry parser per exact MIME / extension and records parserType', async () => {
    // covers: r257
    const cases: Array<{ file: string; mime: string; expected: string; body: string }> = [
      {
        file: 'a.txt',
        mime: 'text/plain',
        expected: 'text',
        body: 'parser selection probe content',
      },
      {
        file: 'b.md',
        mime: 'text/markdown',
        expected: 'text',
        body: '# probe\n\nparser selection probe content',
      },
      {
        file: 'c.html',
        mime: 'text/html',
        expected: 'html',
        body: '<html><body>parser selection probe content</body></html>',
      },
      { file: 'd.csv', mime: 'text/csv', expected: 'csv', body: 'name,value\na,1\nb,2' },
    ];
    for (const c of cases) {
      const result = await ingestSource({
        buffer: enc(c.body),
        filename: c.file,
        notebookId,
        mimeType: c.mime,
      });

      expect(result.status).toBe('ready');
      expect(result.parserType).toBe(c.expected);

      const row = getOrm().select().from(sources).where(eq(sources.id, result.sourceId)).get();
      expect(row?.parserType).toBe(c.expected);
    }
  });

  it('application/* inputs are no longer misrouted to the pdf parser', async () => {
    // covers: r257 — the former prefix-match bug fed application/xml and
    // octet-stream to the first-registered application/* parser (pdf).
    // .xml/.json are text-parser extensions — legal core superset (r258 "at
    // least" txt/md/markdown/csv); they must hit text, never pdf.
    const xmlResult = await ingestSource({
      buffer: enc('<xml/>'),
      filename: 'x.xml',
      notebookId,
      mimeType: 'application/xml',
    });
    expect(xmlResult.parserType).toBe('text');
    await expect(
      ingestSource({
        buffer: enc('\u0000\u0001'),
        filename: 'blob',
        notebookId,
        mimeType: 'application/octet-stream',
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('honors an explicit parserType override by registry id', async () => {
    // covers: r257 — the override used to resolve the id as a MIME type and
    // silently fall back to the text parser.
    const result = await ingestSource({
      buffer: enc('<html><body>override probe</body></html>'),
      filename: 'override.bin',
      notebookId,
      mimeType: 'application/octet-stream',
      parserType: 'html',
    });
    expect(result.status).toBe('ready');
    expect(result.parserType).toBe('html');
  });
});

describe('r258/r295 unsupported formats are rejected with diagnostics', () => {
  it('unknown extension → 415 with mimeType/filename/pluginHint in details', async () => {
    // covers: r258, r295
    try {
      await ingestSource({ buffer: enc('docx bytes'), filename: 'report.docx', notebookId });
      expect.unreachable();
    } catch (error) {
      const e = error as { code: string; details?: Record<string, unknown>; message?: string };
      expect(e.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(e.details?.mimeType).toBe('application/octet-stream');
      expect(e.details?.filename).toBe('report.docx');
      expect(e.details?.pluginHint).toBe('parser-docx');
      expect(e.message).toContain('.docx');
    }
    // No source row leaked by the rejection (r290-style determinism).
    const rows = getOrm().select().from(sources).where(eq(sources.filename, 'report.docx')).all();
    expect(rows).toHaveLength(0);
  });

  it('unknown explicit parserType → 415 as well', async () => {
    // covers: r295
    await expect(
      ingestSource({
        buffer: enc('anything'),
        filename: 'file.txt',
        notebookId,
        parserType: 'nonexistent-parser',
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });
});

describe('r287/r464/r465 markdown semantic preprocessing', () => {
  it('normalizes wikilinks and embeds before chunking', async () => {
    // covers: r464
    const md = [
      '# Notes',
      '',
      'See [[Some Page|the alias]] and [[Other Note]].',
      'Image: ![[diagram.png]] and transclusion ![[Section|sec alias]].',
    ].join('\n');
    const result = await ingestSource({ buffer: enc(md), filename: 'notes.md', notebookId });
    expect(result.status).toBe('ready');

    const chunkRows = getOrm()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, result.sourceId))
      .all();
    const text = chunkRows.map((c) => c.text).join('\n');
    expect(text).toContain('[the alias](Some Page)');
    expect(text).toContain('[Other Note](Other Note)');
    expect(text).toContain('![diagram.png](diagram.png)');
    // Non-image transclusion becomes a retrievable text reference (a link).
    expect(text).toContain('[sec alias](Section)');
    expect(text).not.toContain('[[Some Page');
  });

  it('extracts frontmatter into source.metadata.frontmatter and strips it from chunks', async () => {
    // covers: r465
    const md = [
      '---',
      'title: 研究笔记',
      'tags: [alpha, beta]',
      'aliases:',
      '  - 研究记录',
      '  - notes',
      'date: 2026-09-29',
      '---',
      '',
      'Body content after frontmatter.',
    ].join('\n');
    const result = await ingestSource({ buffer: enc(md), filename: 'meta.md', notebookId });
    expect(result.status).toBe('ready');

    const row = getOrm().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    const frontmatter = (row?.metadata as { frontmatter?: Record<string, unknown> } | null)
      ?.frontmatter;
    expect(frontmatter).toEqual({
      title: '研究笔记',
      tags: ['alpha', 'beta'],
      aliases: ['研究记录', 'notes'],
      date: '2026-09-29',
    });

    const chunkRows = getOrm()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, result.sourceId))
      .all();
    const text = chunkRows.map((c) => c.text).join('\n');
    expect(text).toContain('Body content after frontmatter.');
    expect(text).not.toContain('title: 研究笔记');
    expect(text).not.toContain('---');
  });

  it('leaves plain markdown without frontmatter/wikilinks byte-identical (zero disturbance)', async () => {
    // covers: r287 — preprocessing must not perturb ordinary documents.
    const md = '# Heading\n\nPlain **markdown** body with a [regular link](https://example.com).\n';
    const unit = preprocessMarkdown(md);
    expect(unit.text).toBe(md);
    expect(unit.frontmatter).toBeNull();

    const result = await ingestSource({ buffer: enc(md), filename: 'plain.md', notebookId });
    expect(result.status).toBe('ready');
    const chunkRows = getOrm()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, result.sourceId))
      .all();
    expect(chunkRows.map((c) => c.text).join('\n')).toContain(
      '[regular link](https://example.com)',
    );
  });
});

describe('r52 (rewritten) raw bytes persist for re-parse', () => {
  it('persists the original upload bytes and reads them back', async () => {
    // covers: r52
    const payload = 'raw bytes round-trip probe — 原始字节往返';
    const result = await ingestSource({
      buffer: enc(payload),
      filename: 'roundtrip.txt',
      notebookId,
      mimeType: 'text/plain',
    });
    expect(result.status).toBe('ready');
    // pipeline persists bytes fire-and-forget（best-effort、不阻塞 ready），
    // 有界轮询等落盘，避免与 save 竞态导致偶发 ENOENT。
    const deadline = Date.now() + 5_000;
    while (!(await contentStorage.exists(result.sourceId))) {
      if (Date.now() > deadline) {
        throw new Error(`contentStorage.save did not land for source ${result.sourceId} within 5s`);
      }
      await Bun.sleep(10);
    }
    const stored = await contentStorage.fetch(result.sourceId);
    expect(new TextDecoder().decode(stored)).toBe(payload);
  });
});
