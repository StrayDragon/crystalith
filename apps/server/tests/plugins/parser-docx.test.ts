// covers: r498 + r499（parser-plugins）——官方 parser-docx 榜样：装载后摄取 .docx
// 为 markdown；denylist 时 415 且 pluginHint=parser-docx；GET parsers 不含
// docx 且 diagnostics.plugins.skipped 记入 parser-docx。
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
    wrapLanguageModel: ({ model }: { model: unknown }) => model,
  };
});

mock.module('../../src/rag/embedder.ts', () => ({
  getEmbedModel: async () => null,
  embedSingle: async () => new Float32Array(1024),
  embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(1024)),
}));

import { parserDocx } from '@crystalith-plugin/parser-docx';
import { eq } from 'drizzle-orm';

import { notebooks, sources } from '../../src/db/schema.ts';
import { ingestSource } from '../../src/features/sources/pipeline.ts';
import { discoverExternalPluginIds, importExternalPlugin } from '../../src/plugins/loader.ts';
import { pluginRegistry } from '../../src/plugins/registry.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';
import { buildMinimalDocx } from './minimal-docx.ts';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FIXTURE_TEXT = 'Crystalith parser docx fixture';

const TEST_MODELS = {
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
} as const;

let notebookId: number;

beforeAll(async () => {
  setupIntegrationEnv();
  pluginRegistry.reset();
  resetConfig(TEST_MODELS);
  await pluginRegistry.ensureLoaded();
  notebookId = getOrm().insert(notebooks).values({ name: 'parser-docx' }).returning().get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('parser-docx factory', () => {
  it('converts a minimal .docx to markdown containing the document text', async () => {
    const impl = await parserDocx.factory({
      config: {},
      dataRoot: '/tmp',
      fetch,
    });
    const result = await impl.parse(buildMinimalDocx(FIXTURE_TEXT), 'hello.docx');
    expect(result.text).toContain(FIXTURE_TEXT);
    expect(impl.id).toBe('docx');
    expect(impl.mimeTypes).toContain(DOCX_MIME);
    expect(impl.extensions).toContain('.docx');
  });
});

describe('registry discovery (workspace symlink)', () => {
  it('parser-docx is bundled so the compiled binary can discover it without node_modules', async () => {
    expect(discoverExternalPluginIds([])).toContain('parser-docx');
    const plugin = await importExternalPlugin('parser-docx');
    expect(plugin.id).toBe('parser-docx');
    expect(plugin.kind).toBe('parser');
  });

  it('parser-docx is discovered from node_modules scope and loaded', () => {
    expect(pluginRegistry.isLoaded('parser-docx')).toBeTrue();
    const impl = pluginRegistry.implOf<{ parse: (buf: Uint8Array) => Promise<unknown> }>(
      'parser-docx',
    );
    expect(typeof impl?.parse).toBe('function');
  });
});

describe('r499 ingest when loaded vs denylist', () => {
  it('loaded: .docx ingest is ready with parserType=docx and parserPluginId', async () => {
    const result = await ingestSource({
      buffer: buildMinimalDocx(FIXTURE_TEXT),
      filename: 'lecture.docx',
      notebookId,
      mimeType: DOCX_MIME,
    });
    expect(result.status).toBe('ready');
    expect(result.parserType).toBe('docx');
    expect(result.text).toContain(FIXTURE_TEXT);

    const row = getOrm().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    expect(row?.parserType).toBe('docx');
    expect((row?.metadata as { parserPluginId?: string } | null)?.parserPluginId).toBe(
      'parser-docx',
    );
  });

  it('denylist: .docx upload is 415 with pluginHint=parser-docx', async () => {
    pluginRegistry.reset();
    resetConfig({
      ...TEST_MODELS,
      raw: { plugins: { disabled: ['parser-docx'] } },
    });
    await pluginRegistry.ensureLoaded();
    expect(pluginRegistry.isLoaded('parser-docx')).toBeFalse();

    try {
      await ingestSource({
        buffer: buildMinimalDocx(FIXTURE_TEXT),
        filename: 'blocked.docx',
        notebookId,
      });
      expect.unreachable();
    } catch (error) {
      const e = error as { code: string; details?: Record<string, unknown> };
      expect(e.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(e.details?.mimeType).toBe(DOCX_MIME);
      expect(e.details?.filename).toBe('blocked.docx');
      expect(e.details?.pluginHint).toBe('parser-docx');
    }
    const rows = getOrm().select().from(sources).where(eq(sources.filename, 'blocked.docx')).all();
    expect(rows).toHaveLength(0);
  });
});

describe('r498 parsers list matches loaded plugins after denylist', () => {
  it('GET /v2/sources/parsers omits docx and skipped records PLUGIN_DISABLED', async () => {
    pluginRegistry.reset();
    resetConfig({
      ...TEST_MODELS,
      raw: { plugins: { disabled: ['parser-docx'] } },
    });
    await pluginRegistry.ensureLoaded();

    const app = createApp();
    const parsersRes = await app.handle(new Request('http://test.local/v2/sources/parsers'));
    expect(parsersRes.status).toBe(200);
    const parsers = (await parsersRes.json()) as Array<{ id: string; pluginId?: string }>;
    expect(parsers.some((p) => p.id === 'text')).toBeTrue();
    expect(parsers.some((p) => p.id === 'docx' || p.pluginId === 'parser-docx')).toBeFalse();

    const toolsRes = await app.handle(new Request('http://test.local/v2/workspace/tools'));
    expect(toolsRes.status).toBe(200);
    const tools = (await toolsRes.json()) as {
      diagnostics: { plugins: { skipped: Record<string, { errorCode?: string }> } };
    };
    expect(tools.diagnostics.plugins.skipped['parser-docx']?.errorCode).toBe('PLUGIN_DISABLED');
  });
});
