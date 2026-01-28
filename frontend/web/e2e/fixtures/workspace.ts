import { expect, test as base, type Page } from '@playwright/test';

type WorkspaceNotebook = {
  id: number;
  name: string;
  updated_at: string;
};

type WorkspaceSource = {
  id: number;
  notebook_id: number;
  filename: string;
  mime_type: string | null;
  parser_type: string;
  status: 'processing' | 'ready' | 'failed';
  error_message: string | null;
  chunk_count?: number;
  created_at: string;
  updated_at: string;
};

type WorkspaceSession = {
  id: number;
  notebook_id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type WorkspaceMessage = {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: any[];
};

type WorkspaceOutput = {
  id: number;
  notebook_id: number;
  type: string;
  prompt?: string | null;
  chunk_ids?: number[];
  content?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type WorkspaceMockState = {
  notebooks: WorkspaceNotebook[];
  sources: WorkspaceSource[];
  sessions: WorkspaceSession[];
  outputs: WorkspaceOutput[];
  messagesBySessionId: Record<number, WorkspaceMessage[]>;
  slidesDrafts: Array<{
    id: number;
    notebook_id: number;
    title: string;
    prompt: string;
    engine: string;
    chunk_ids: number[];
    outline: Record<string, unknown> | null;
    markdown: string | null;
    generation_config: Record<string, unknown>;
    stage: string;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
  }>;
  analysis: {
    topics: Array<{ id: string; name: string; chunk_ids: number[]; keywords: string[] }>;
    relations: Array<{ source_chunk_id: number; target_chunk_id: number; relation_type: 'similar' | 'references' | 'contradicts'; score: number }>;
    contradictions: Array<{ source_chunk_id: number; target_chunk_id: number; relation_type: 'similar' | 'references' | 'contradicts'; score: number }>;
  };
  tools: {
    tools: Array<{
      id: string;
      label: string;
      description: string;
      tone?: string;
      output_type: string;
      prompt: string;
      enabled: boolean;
    }>;
  };
  models: {
    models: Array<{
      id: string;
      provider: 'openai' | 'ollama';
      model: string;
      display_name: string;
      description: string;
      capabilities?: string[];
    }>;
    default_chat: string | null;
    default_embedding: string | null;
  };
  slidesConfig: {
    defaults: {
      quantity: string;
      audience: string;
      structure: string;
      tone: string;
      language: string;
      density: string;
      theme_preset: string;
      frontmatter: string;
    };
    quantity_options: Array<{ id: string; label: string; is_default: boolean }>;
    audience_options: Array<{ id: string; label: string; is_default: boolean }>;
    structure_options: Array<{ id: string; label: string; is_default: boolean }>;
    tone_options: Array<{ id: string; label: string; is_default: boolean }>;
    language_options: Array<{ id: string; label: string; is_default: boolean }>;
    density_options: Array<{ id: string; label: string; is_default: boolean }>;
    theme_preset_options: Array<{
      id: string;
      label: string;
      template: { theme: string; transition: string; background: string };
    }>;
  };
  toolConfig: {
    tool_id: string;
    tool_label: string;
    quantity_options: Array<{ id: string; label: string; is_default: boolean }>;
    difficulty_options: Array<{ id: string; label: string; is_default: boolean }>;
    topic_placeholder: string;
    supports_topic: boolean;
  };
  extractors: {
    extractors: Array<{
      type: 'trafilatura' | 'firecrawl' | 'browserless';
      enabled: boolean;
      available: boolean;
      display_name: string;
      description: string;
      priority: number;
      requires_api_key: boolean;
      requires_service: boolean;
    }>;
    default_extractor: 'trafilatura' | 'firecrawl' | 'browserless' | null;
  };
  nextIds: {
    notebook: number;
    source: number;
    session: number;
    message: number;
    output: number;
    slideDraft: number;
  };
};

type WorkspaceFixtures = {
  workspace: WorkspaceMockState;
  isLive: boolean;
  waitForWorkspaceReady: () => Promise<void>;
};

const DEFAULT_TIMESTAMP = '2026-01-01T00:00:00Z';

const DEFAULT_STATE: WorkspaceMockState = {
  notebooks: [
    { id: 1, name: 'Demo Notebook', updated_at: DEFAULT_TIMESTAMP },
    { id: 2, name: 'Beta Notebook', updated_at: DEFAULT_TIMESTAMP },
  ],
  sources: [
    {
      id: 101,
      notebook_id: 1,
      filename: 'OpenAI Research Brief.pdf',
      mime_type: 'application/pdf',
      parser_type: 'pdf',
      status: 'ready',
      error_message: null,
      chunk_count: 12,
      created_at: DEFAULT_TIMESTAMP,
      updated_at: DEFAULT_TIMESTAMP,
    },
  ],
  sessions: [
    { id: 201, notebook_id: 1, title: 'Session Alpha', created_at: DEFAULT_TIMESTAMP, updated_at: DEFAULT_TIMESTAMP },
    { id: 202, notebook_id: 1, title: 'Session Beta', created_at: DEFAULT_TIMESTAMP, updated_at: DEFAULT_TIMESTAMP },
  ],
  outputs: [],
  messagesBySessionId: {
    201: [],
    202: [],
  },
  slidesDrafts: [],
  analysis: {
    topics: [
      { id: 'topic-1', name: 'AI 研究', chunk_ids: [1], keywords: ['AI', 'Research'] },
    ],
    relations: [
      { source_chunk_id: 1, target_chunk_id: 2, relation_type: 'similar', score: 0.72 },
    ],
    contradictions: [],
  },
  tools: {
    tools: [
      {
        id: 'slides',
        label: '演示',
        description: '生成演示文稿',
        tone: 'slate',
        output_type: 'SLIDES',
        prompt: '生成演示大纲与 Slidev Markdown。',
        enabled: true,
      },
      {
        id: 'briefing',
        label: '报告',
        description: '生成高层摘要报告',
        tone: 'amber',
        output_type: 'BRIEFING',
        prompt: '生成一份简洁的研究报告。',
        enabled: true,
      },
    ],
  },
  models: {
    models: [
      {
        id: 'test-chat',
        provider: 'openai',
        model: 'gpt-4o-mini',
        display_name: '测试模型',
        description: 'Mock chat model',
        capabilities: ['chat'],
      },
    ],
    default_chat: 'test-chat',
    default_embedding: null,
  },
  slidesConfig: {
    defaults: {
      quantity: 'standard',
      audience: 'general',
      structure: 'standard',
      tone: 'professional',
      language: 'zh',
      density: 'standard',
      theme_preset: 'minimal-clean',
      frontmatter: '',
    },
    quantity_options: [
      { id: 'short', label: '精简', is_default: false },
      { id: 'standard', label: '标准', is_default: true },
    ],
    audience_options: [{ id: 'general', label: '通用受众', is_default: true }],
    structure_options: [{ id: 'standard', label: '通用结构', is_default: true }],
    tone_options: [{ id: 'professional', label: '正式专业', is_default: true }],
    language_options: [{ id: 'zh', label: '中文', is_default: true }],
    density_options: [{ id: 'standard', label: '标准', is_default: true }],
    theme_preset_options: [
      {
        id: 'minimal-clean',
        label: '清爽极简',
        template: { theme: 'default', transition: 'fade', background: '#fff' },
      },
    ],
  },
  toolConfig: {
    tool_id: 'briefing',
    tool_label: '报告',
    quantity_options: [
      { id: 'less', label: '更少', is_default: false },
      { id: 'standard', label: '标准', is_default: true },
      { id: 'more', label: '更多', is_default: false },
    ],
    difficulty_options: [
      { id: 'easy', label: '基础', is_default: false },
      { id: 'medium', label: '中等', is_default: true },
      { id: 'hard', label: '深入', is_default: false },
    ],
    topic_placeholder: '输入报告主题',
    supports_topic: true,
  },
  extractors: {
    extractors: [
      {
        type: 'trafilatura',
        enabled: true,
        available: true,
        display_name: 'Trafilatura',
        description: '默认网页提取器',
        priority: 1,
        requires_api_key: false,
        requires_service: false,
      },
    ],
    default_extractor: 'trafilatura',
  },
  nextIds: {
    notebook: 3,
    source: 102,
    session: 203,
    message: 1,
    output: 1,
    slideDraft: 1,
  },
};

function cloneState(): WorkspaceMockState {
  return JSON.parse(JSON.stringify(DEFAULT_STATE)) as WorkspaceMockState;
}

function appendMessage(
  state: WorkspaceMockState,
  sessionId: number,
  role: 'user' | 'assistant',
  content: string,
) {
  const nextId = state.nextIds.message++;
  const entry: WorkspaceMessage = {
    id: nextId,
    role,
    content,
    citations: [],
  };
  const messages = state.messagesBySessionId[sessionId] ?? [];
  messages.push(entry);
  state.messagesBySessionId[sessionId] = messages;
}

function buildStreamBody(answer: string) {
  const first = answer.slice(0, Math.max(4, Math.floor(answer.length / 2)));
  const second = answer.slice(first.length);
  const donePayload = {
    citations: [],
    evidence: false,
    confidence: 0.62,
    created_at: DEFAULT_TIMESTAMP,
    context: {
      total_tokens: 120,
      system_tokens: 10,
      history_tokens: 30,
      retrieval_tokens: 40,
      query_tokens: 20,
      max_tokens: 2048,
      compressed: false,
    },
  };
  return [
    'event: chunk',
    `data: ${JSON.stringify({ text: first })}`,
    '',
    'event: chunk',
    `data: ${JSON.stringify({ text: second })}`,
    '',
    'event: done',
    `data: ${JSON.stringify(donePayload)}`,
    '',
  ].join('\n');
}

async function installWorkspaceMocks(page: Page, state: WorkspaceMockState) {
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (data: unknown, status = 200) =>
      route.fulfill({ status, json: data });
    const text = (body: string, status = 200, headers?: Record<string, string>) =>
      route.fulfill({ status, body, headers });

    const parseBody = () => {
      try {
        return request.postDataJSON();
      } catch {
        return null;
      }
    };

    if (path === '/v1/notebooks' && method === 'GET') {
      return json(state.notebooks);
    }

    if (path === '/v1/notebooks' && method === 'POST') {
      const body = parseBody();
      const name = body?.name ?? '未命名笔记本';
      const created: WorkspaceNotebook = {
        id: state.nextIds.notebook++,
        name,
        updated_at: DEFAULT_TIMESTAMP,
      };
      state.notebooks.push(created);
      return json(created, 201);
    }

    const notebookMatch = path.match(/^\/v1\/notebooks\/(\d+)$/);
    if (notebookMatch && method === 'PATCH') {
      const notebookId = Number(notebookMatch[1]);
      const body = parseBody();
      const target = state.notebooks.find((item) => item.id === notebookId);
      if (!target) return json({ detail: 'Not found' }, 404);
      target.name = body?.name ?? target.name;
      target.updated_at = DEFAULT_TIMESTAMP;
      return json(target);
    }

    if (notebookMatch && method === 'DELETE') {
      const notebookId = Number(notebookMatch[1]);
      state.notebooks = state.notebooks.filter((item) => item.id !== notebookId);
      return text('', 204);
    }

    const sourcesMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sources$/);
    if (sourcesMatch && method === 'GET') {
      return json(state.sources.filter((item) => item.notebook_id === Number(sourcesMatch[1])));
    }

    const sourcesSearchMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sources\/search$/);
    if (sourcesSearchMatch && method === 'POST') {
      const body = parseBody();
      const query = body?.query ?? 'search';
      const engine = body?.engine ?? 'Web';
      const mode = body?.mode ?? 'Fast Research';
      return json({
        status: 'ok',
        query,
        engine,
        mode,
        results: [
          {
            title: `${query} 结果 1`,
            url: 'https://example.com/result-1',
            snippet: '示例摘要 1',
            source: 'mock',
          },
          {
            title: `${query} 结果 2`,
            url: 'https://example.com/result-2',
            snippet: '示例摘要 2',
            source: 'mock',
          },
        ],
        message: '',
        created_at: DEFAULT_TIMESTAMP,
      });
    }

    const sourcesExtractorsMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sources\/extractors$/);
    if (sourcesExtractorsMatch && method === 'GET') {
      return json(state.extractors);
    }

    const sourcesFromUrlMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sources\/from-url$/);
    if (sourcesFromUrlMatch && method === 'POST') {
      const notebookId = Number(sourcesFromUrlMatch[1]);
      const body = parseBody() ?? {};
      const title = body.title || body.url || '新来源';
      const created: WorkspaceSource = {
        id: state.nextIds.source++,
        notebook_id: notebookId,
        filename: title,
        mime_type: 'text/html',
        parser_type: body.mode === 'fetch' ? 'web' : 'link',
        status: 'ready',
        error_message: null,
        chunk_count: 3,
        created_at: DEFAULT_TIMESTAMP,
        updated_at: DEFAULT_TIMESTAMP,
      };
      state.sources.unshift(created);
      return json(created, 201);
    }

    const sourceSummaryMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sources\/(\d+)\/summary$/);
    if (sourceSummaryMatch && method === 'GET') {
      const sourceId = Number(sourceSummaryMatch[2]);
      return json({
        source_id: sourceId,
        summary: '这是一个用于测试的来源摘要。',
        key_points: ['关键点一', '关键点二'],
        topics: ['AI', 'Research'],
        word_count: 1200,
        generated_at: DEFAULT_TIMESTAMP,
      });
    }

    const sourceChunksMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sources\/(\d+)\/chunks$/);
    if (sourceChunksMatch && method === 'GET') {
      return json([
        {
          id: 1,
          chunk_index: 0,
          text: '示例段落内容，用于展示来源原文片段。',
          start_offset: 0,
          end_offset: 42,
          metadata: { section: 'intro' },
        },
      ]);
    }

    const sourceQaMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sources\/(\d+)\/qa$/);
    if (sourceQaMatch && method === 'POST') {
      const sourceId = Number(sourceQaMatch[2]);
      return json({
        source_id: sourceId,
        answer: '这是基于来源的示例回答。',
        created_at: DEFAULT_TIMESTAMP,
      });
    }

    const sessionsMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sessions$/);
    if (sessionsMatch && method === 'GET') {
      const notebookId = Number(sessionsMatch[1]);
      return json(state.sessions.filter((item) => item.notebook_id === notebookId));
    }

    if (sessionsMatch && method === 'POST') {
      const body = parseBody();
      const created: WorkspaceSession = {
        id: state.nextIds.session++,
        notebook_id: Number(sessionsMatch[1]),
        title: body?.title ?? '未命名会话',
        created_at: DEFAULT_TIMESTAMP,
        updated_at: DEFAULT_TIMESTAMP,
      };
      state.sessions.unshift(created);
      state.messagesBySessionId[created.id] = [];
      return json(created, 201);
    }

    const messagesMatch = path.match(/^\/v1\/notebooks\/(\d+)\/sessions\/(\d+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      const sessionId = Number(messagesMatch[2]);
      return json(state.messagesBySessionId[sessionId] ?? []);
    }

    const outputsMatch = path.match(/^\/v1\/notebooks\/(\d+)\/outputs$/);
    if (outputsMatch && method === 'GET') {
      const notebookId = Number(outputsMatch[1]);
      return json(state.outputs.filter((item) => item.notebook_id === notebookId));
    }

    const outputItemMatch = path.match(/^\/v1\/notebooks\/(\d+)\/outputs\/([^/]+)$/);
    if (outputItemMatch && method === 'GET') {
      const outputId = Number(outputItemMatch[2]);
      if (!Number.isFinite(outputId)) return json({ detail: 'Not found' }, 404);
      const output = state.outputs.find((item) => item.id === outputId);
      if (!output) return json({ detail: 'Not found' }, 404);
      return json(output);
    }

    if (outputItemMatch && method === 'DELETE') {
      const outputId = Number(outputItemMatch[2]);
      state.outputs = state.outputs.filter((item) => item.id !== outputId);
      return text('', 204);
    }

    if (outputItemMatch && method === 'POST') {
      const notebookId = Number(outputItemMatch[1]);
      const outputType = outputItemMatch[2];
      const body = parseBody() ?? {};
      const created: WorkspaceOutput = {
        id: state.nextIds.output++,
        notebook_id: notebookId,
        type: outputType,
        prompt: body?.prompt ?? '',
        chunk_ids: body?.chunk_ids ?? [],
        content: { paragraph: body?.prompt ?? '' },
        created_at: DEFAULT_TIMESTAMP,
        updated_at: DEFAULT_TIMESTAMP,
      };
      state.outputs.unshift(created);
      return json(created, 201);
    }

    const qaMatch = path.match(/^\/v1\/notebooks\/(\d+)\/qa$/);
    if (qaMatch && method === 'POST') {
      const body = parseBody();
      const sessionId = body?.session_id ?? state.sessions[0]?.id ?? 0;
      const answer = '这是一个模拟回答。';
      if (sessionId) {
        appendMessage(state, sessionId, 'user', body?.question ?? '');
        appendMessage(state, sessionId, 'assistant', answer);
      }
      return json({
        answer,
        citations: [],
        evidence: false,
        confidence: 0.6,
        created_at: DEFAULT_TIMESTAMP,
      });
    }

    const qaStreamMatch = path.match(/^\/v1\/notebooks\/(\d+)\/qa\/stream$/);
    if (qaStreamMatch && method === 'POST') {
      const body = parseBody();
      const sessionId = body?.session_id ?? state.sessions[0]?.id ?? 0;
      const answer = '这是一次模拟流式示例回答。';
      if (sessionId) {
        appendMessage(state, sessionId, 'user', body?.question ?? '');
        appendMessage(state, sessionId, 'assistant', answer);
      }
      return text(buildStreamBody(answer), 200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      });
    }

    const analysisMatch = path.match(/^\/v1\/notebooks\/(\d+)\/analysis$/);
    if (analysisMatch && method === 'GET') {
      return json(state.analysis);
    }

    const slidesDraftsMatch = path.match(/^\/v1\/notebooks\/(\d+)\/slides\/drafts$/);
    if (slidesDraftsMatch && method === 'POST') {
      const notebookId = Number(slidesDraftsMatch[1]);
      const body = parseBody() ?? {};
      const created = {
        id: state.nextIds.slideDraft++,
        notebook_id: notebookId,
        title: body?.title ?? '演示',
        prompt: body?.prompt ?? '',
        engine: 'slidev',
        chunk_ids: body?.chunk_ids ?? [],
        outline: null,
        markdown: null,
        generation_config: body?.generation_config ?? {},
        stage: 'input',
        status: 'idle',
        error_message: null,
        created_at: DEFAULT_TIMESTAMP,
        updated_at: DEFAULT_TIMESTAMP,
      };
      state.slidesDrafts.push(created);
      return json(created, 201);
    }

    const slidesLatestMatch = path.match(/^\/v1\/notebooks\/(\d+)\/slides\/drafts\/latest$/);
    if (slidesLatestMatch && method === 'GET') {
      const notebookId = Number(slidesLatestMatch[1]);
      const latest = [...state.slidesDrafts].reverse().find((draft) => draft.notebook_id === notebookId);
      if (!latest) return json({ detail: 'Not found' }, 404);
      return json(latest);
    }

    const slidesDraftMatch = path.match(/^\/v1\/notebooks\/(\d+)\/slides\/drafts\/(\d+)(?:\\/(.*))?$/);
    if (slidesDraftMatch) {
      const draftId = Number(slidesDraftMatch[2]);
      const action = slidesDraftMatch[3];
      const draft = state.slidesDrafts.find((item) => item.id === draftId);

      if (!draft && method !== 'GET') return json({ detail: 'Not found' }, 404);

      if (!action && method === 'GET') {
        if (!draft) return json({ detail: 'Not found' }, 404);
        return json(draft);
      }

      if (action === 'outline' && method === 'PUT') {
        const body = parseBody() ?? {};
        if (draft) draft.outline = body?.outline ?? draft.outline;
        return json(draft ?? { detail: 'Not found' }, draft ? 200 : 404);
      }

      if (action === 'markdown' && method === 'PUT') {
        const body = parseBody() ?? {};
        if (draft) draft.markdown = body?.markdown ?? draft.markdown;
        return json(draft ?? { detail: 'Not found' }, draft ? 200 : 404);
      }

      if (action === 'outline/stream' && method === 'GET') {
        return text('event: done\\ndata: {}\\n\\n', 200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        });
      }

      if (action === 'markdown/stream' && method === 'GET') {
        return text('event: done\\ndata: {}\\n\\n', 200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        });
      }
    }

    const researchStreamMatch = path.match(/^\/v1\/notebooks\/(\d+)\/research\/(\d+)\/stream$/);
    if (researchStreamMatch && method === 'GET') {
      const body = [
        'event: status',
        'data: {\"status\":\"planning\",\"iteration\":1,\"topic\":\"Mock Research\"}',
        '',
        'event: done',
        'data: {\"status\":\"completed\",\"total_results\":1,\"has_report\":false}',
        '',
      ].join('\\n');
      return text(body, 200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      });
    }

    if (path === '/v1/workspace/tools' && method === 'GET') {
      return json(state.tools);
    }

    if (path === '/v1/workspace/tools/slides/config' && method === 'GET') {
      return json(state.slidesConfig);
    }

    const toolConfigMatch = path.match(/^\/v1\/workspace\/tools\/(.+)\/config$/);
    if (toolConfigMatch && method === 'GET') {
      return json(state.toolConfig);
    }

    if (path === '/v1/models' && method === 'GET') {
      const capability = url.searchParams.get('capability');
      if (!capability) return json(state.models);
      const filtered = state.models.models.filter((model) =>
        (model.capabilities ?? []).includes(capability),
      );
      return json({ ...state.models, models: filtered });
    }

    return route.fulfill({ status: 404, body: 'Not mocked' });
  });
}

export const test = base.extend<WorkspaceFixtures>({
  workspace: async ({}, use) => {
    const state = cloneState();
    await use(state);
  },
  isLive: async ({}, use, testInfo) => {
    await use(testInfo.project.name === 'live');
  },
  waitForWorkspaceReady: async ({ page, isLive }, use) => {
    await use(async () => {
      await page.waitForLoadState('domcontentloaded');
      const panels = [
        page.locator('[aria-label="来源"]'),
        page.locator('[aria-label="对话"]'),
        page.locator('[aria-label="Studio"]'),
      ];
      if (isLive) {
        await expect.poll(
          async () =>
            (await panels[0].isVisible()) &&
            (await panels[1].isVisible()) &&
            (await panels[2].isVisible()),
          { timeout: 60000 },
        ).toBe(true);
      } else {
        await expect(panels[0]).toBeVisible();
        await expect(panels[1]).toBeVisible();
        await expect(panels[2]).toBeVisible();
      }
    });
  },
  _mockWorkspace: [
    async ({ page, workspace, isLive }, use) => {
      if (!isLive) {
        await installWorkspaceMocks(page, workspace);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
