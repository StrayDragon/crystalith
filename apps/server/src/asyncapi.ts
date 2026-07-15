// AsyncAPI 3.0 document for streaming endpoints (SSE channels).
//
// The QA stream and research progress stream are documented as AsyncAPI
// channels so external consumers can generate async SDK clients. Event
// payloads are described as inline JSON schemas (matching the shared Zod
// schemas in @crystalith/shared/schemas/streaming/*).
export interface AsyncApiChannel {
  name: string;
  description: string;
  address: string;
  events: Array<{
    name: string;
    description: string;
    payload: Record<string, unknown>;
  }>;
}

const QA_STREAM_CHANNEL: AsyncApiChannel = {
  name: 'qaStream',
  description: 'SSE stream of QA response events (chunk, state_snapshot, done, error).',
  address: '/v2/qa/stream',
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
          message_id: { type: 'integer', nullable: true },
          shared_state: { type: 'object' },
        },
      },
    },
    {
      name: 'done',
      description: 'Final event with citations and the completed message id.',
      payload: {
        type: 'object',
        properties: {
          message_id: { type: 'integer', nullable: true },
          citations: { type: 'array', items: { type: 'object' } },
          tool_calls: { type: 'array', items: { type: 'object' } },
        },
      },
    },
    {
      name: 'error',
      description: 'Error event with a human-readable message.',
      payload: {
        type: 'object',
        properties: { message: { type: 'string' }, error_code: { type: 'string' } },
        required: ['message'],
      },
    },
  ],
};

const RESEARCH_PROGRESS_CHANNEL: AsyncApiChannel = {
  name: 'researchProgress',
  description: 'SSE stream of research agent progress events.',
  address: '/v2/research/sessions/{id}/stream',
  events: [
    {
      name: 'plan_ready',
      description: 'Search plan is ready for user review.',
      payload: {
        type: 'object',
        properties: { session_id: { type: 'integer' }, plan: { type: 'object' } },
      },
    },
    {
      name: 'search_result',
      description: 'A web search result was retrieved.',
      payload: {
        type: 'object',
        properties: { session_id: { type: 'integer' }, result: { type: 'object' } },
      },
    },
    {
      name: 'analysis',
      description: 'Analysis result for the current iteration.',
      payload: {
        type: 'object',
        properties: { session_id: { type: 'integer' }, analysis: { type: 'object' } },
      },
    },
    {
      name: 'done',
      description: 'Research completed with a final report.',
      payload: {
        type: 'object',
        properties: {
          session_id: { type: 'integer' },
          final_report: { type: 'string', nullable: true },
          outputs: { type: 'array', items: { type: 'object' } },
        },
      },
    },
    {
      name: 'error',
      description: 'Research encountered an error.',
      payload: {
        type: 'object',
        properties: { session_id: { type: 'integer' }, message: { type: 'string' } },
        required: ['message'],
      },
    },
  ],
};

/** Generate the AsyncAPI 3.0 document. */
export function generateAsyncApiDocument(info?: {
  title: string;
  version: string;
  description?: string;
}): Record<string, unknown> {
  const {
    title = 'Crystalith v2 Streaming API',
    version = '2.0.0-dev',
    description = 'SSE streaming channels for QA and research agents.',
  } = info ?? {};
  const channels: Record<string, unknown> = {};
  for (const ch of [QA_STREAM_CHANNEL, RESEARCH_PROGRESS_CHANNEL]) {
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
      messages,
    };
  }

  return {
    asyncapi: '3.0.0',
    info: { title, version, description },
    channels,
  };
}
