// AsyncAPI 3.0 document for streaming endpoints (SSE channels).
//
// Verb convention (c70):
//   - QA interactive generation → POST (large body)
//   - Research / studio progress on existing resources → GET
// Paths are notebook-nested after c69.
export interface AsyncApiChannel {
  name: string;
  description: string;
  address: string;
  /** HTTP method for the SSE subscribe/send operation (c70). */
  method: 'GET' | 'POST';
  events: Array<{
    name: string;
    description: string;
    payload: Record<string, unknown>;
  }>;
}

const QA_STREAM_CHANNEL: AsyncApiChannel = {
  name: 'qaStream',
  description:
    'SSE stream of QA response events (chunk, state_snapshot, done, error). POST with JSON body.',
  address: '/v2/notebooks/{nid}/qa/stream',
  method: 'POST',
  events: [
    {
      name: 'chunk',
      description: 'A text delta chunk of the streaming answer.',
      payload: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    {
      name: 'state_snapshot',
      description: 'Snapshot of the session state (includes the stable message id).',
      payload: {
        type: 'object',
        properties: {
          messageId: { type: 'integer', nullable: true },
          sharedState: { type: 'object' },
        },
      },
    },
    {
      name: 'done',
      description: 'Final event with citations and the completed message id.',
      payload: {
        type: 'object',
        properties: {
          messageId: { type: 'integer', nullable: true },
          citations: { type: 'array', items: { type: 'object' } },
          toolCalls: { type: 'array', items: { type: 'object' } },
        },
      },
    },
    {
      name: 'error',
      description: 'Error event with a human-readable message.',
      payload: {
        type: 'object',
        properties: { message: { type: 'string' }, errorCode: { type: 'string' } },
        required: ['message'],
      },
    },
  ],
};

const RESEARCH_PROGRESS_CHANNEL: AsyncApiChannel = {
  name: 'researchProgress',
  description:
    'SSE progress for an existing research session. GET subscribe; path uses notebook :nid.',
  address: '/v2/notebooks/{nid}/research/{id}/stream',
  method: 'GET',
  events: [
    {
      name: 'plan_ready',
      description: 'Search plan is ready for user review.',
      payload: {
        type: 'object',
        properties: { sessionId: { type: 'integer' }, plan: { type: 'object' } },
      },
    },
    {
      name: 'search_result',
      description: 'A web search result was retrieved.',
      payload: {
        type: 'object',
        properties: { sessionId: { type: 'integer' }, result: { type: 'object' } },
      },
    },
    {
      name: 'analysis',
      description: 'Analysis result for the current iteration.',
      payload: {
        type: 'object',
        properties: { sessionId: { type: 'integer' }, analysis: { type: 'object' } },
      },
    },
    {
      name: 'done',
      description: 'Research completed (or cancelled). Matches runtime SSE done payload.',
      payload: {
        type: 'object',
        properties: {
          type: { type: 'string', const: 'done' },
          status: { type: 'string' },
          totalResults: { type: 'integer' },
          hasReport: { type: 'boolean' },
        },
        required: ['type', 'status', 'totalResults', 'hasReport'],
      },
    },
    {
      name: 'error',
      description: 'Research encountered an error.',
      payload: {
        type: 'object',
        properties: { sessionId: { type: 'integer' }, message: { type: 'string' } },
        required: ['message'],
      },
    },
  ],
};

const STUDIO_OUTLINE_STREAM_CHANNEL: AsyncApiChannel = {
  name: 'studioOutlineStream',
  description: 'SSE stream for slide outline generation on an existing draft. GET subscribe.',
  address: '/v2/notebooks/{nid}/studio/slides/{id}/outline/stream',
  method: 'GET',
  events: [
    {
      name: 'chunk',
      description: 'Outline generation progress / text delta (implementation-defined).',
      payload: { type: 'object' },
    },
    {
      name: 'done',
      description: 'Outline stream completed.',
      payload: { type: 'object' },
    },
    {
      name: 'error',
      description: 'Outline stream error.',
      payload: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
    },
  ],
};

const STUDIO_MARKDOWN_STREAM_CHANNEL: AsyncApiChannel = {
  name: 'studioMarkdownStream',
  description: 'SSE stream for slide markdown generation on an existing draft. GET subscribe.',
  address: '/v2/notebooks/{nid}/studio/slides/{id}/markdown/stream',
  method: 'GET',
  events: [
    {
      name: 'chunk',
      description: 'Markdown generation progress / text delta (implementation-defined).',
      payload: { type: 'object' },
    },
    {
      name: 'done',
      description: 'Markdown stream completed.',
      payload: { type: 'object' },
    },
    {
      name: 'error',
      description: 'Markdown stream error.',
      payload: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
    },
  ],
};

const ALL_CHANNELS = [
  QA_STREAM_CHANNEL,
  RESEARCH_PROGRESS_CHANNEL,
  STUDIO_OUTLINE_STREAM_CHANNEL,
  STUDIO_MARKDOWN_STREAM_CHANNEL,
] as const;

/** Generate the AsyncAPI 3.0 document. */
export function generateAsyncApiDocument(info?: {
  title: string;
  version: string;
  description?: string;
}): Record<string, unknown> {
  const {
    title = 'Crystalith v2 Streaming API',
    version = '2.0.0-dev',
    description = 'SSE streaming channels for QA, research, and studio (c70 verb conventions).',
  } = info ?? {};
  const channels: Record<string, unknown> = {};
  for (const ch of ALL_CHANNELS) {
    const messages: Record<string, unknown> = {};
    for (const ev of ch.events) {
      messages[ev.name] = {
        description: ev.description,
        payload: ev.payload,
      };
    }
    channels[ch.name] = {
      address: ch.address,
      description: ch.description,
      // AsyncAPI 3 bindings: document HTTP method alongside address (c70).
      bindings: {
        http: {
          method: ch.method,
        },
      },
      messages,
    };
  }

  return {
    asyncapi: '3.0.0',
    info: { title, version, description },
    channels,
  };
}
