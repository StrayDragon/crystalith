// AsyncAPI 3.0 document for streaming endpoints (SSE channels).
//
// Verb convention (c70):
//   - QA interactive generation → POST (large body)
//   - Research / studio progress on existing resources → GET
// Paths are notebook-nested after c69.
//
// 文案约定与 OpenAPI 一致：中文、干脆，写稳定业务语义；不写 REST/状态码废话。
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
  description: '笔记本问答 SSE（chunk / state_snapshot / done / error）；POST JSON body',
  address: '/v2/notebooks/{nid}/qa/stream',
  method: 'POST',
  events: [
    {
      name: 'chunk',
      description: '答案文本增量',
      payload: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    {
      name: 'state_snapshot',
      description: '会话状态快照（含稳定 messageId）',
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
      description: '结束事件（引用与完成的 messageId）',
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
      description: '错误（可读 message）',
      payload: {
        type: 'object',
        properties: { message: { type: 'string' }, errorCode: { type: 'string' } },
        required: ['message'],
      },
    },
  ],
};

const STUDIO_OUTLINE_STREAM_CHANNEL: AsyncApiChannel = {
  name: 'studioOutlineStream',
  description: '幻灯片大纲生成 SSE；对已有草稿 GET 订阅',
  address: '/v2/notebooks/{nid}/studio/slides/{id}/outline/stream',
  method: 'GET',
  events: [
    {
      name: 'chunk',
      description: '大纲生成进度 / 文本增量',
      payload: { type: 'object' },
    },
    {
      name: 'done',
      description: '大纲流结束',
      payload: { type: 'object' },
    },
    {
      name: 'error',
      description: '大纲流错误',
      payload: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
    },
  ],
};

const STUDIO_MARKDOWN_STREAM_CHANNEL: AsyncApiChannel = {
  name: 'studioMarkdownStream',
  description: '幻灯片 markdown 生成 SSE；对已有草稿 GET 订阅',
  address: '/v2/notebooks/{nid}/studio/slides/{id}/markdown/stream',
  method: 'GET',
  events: [
    {
      name: 'chunk',
      description: 'markdown 生成进度 / 文本增量',
      payload: { type: 'object' },
    },
    {
      name: 'done',
      description: 'markdown 流结束',
      payload: { type: 'object' },
    },
    {
      name: 'error',
      description: 'markdown 流错误',
      payload: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
    },
  ],
};

const RESEARCH_STREAM_CHANNEL: AsyncApiChannel = {
  name: 'researchStream',
  description: 'ResearchRun 进度 SSE；GET 订阅',
  address: '/v2/notebooks/{nid}/research/{rid}/stream',
  method: 'GET',
  events: [
    {
      name: 'status',
      description: 'ResearchRun 状态迁移',
      payload: {
        type: 'object',
        properties: { status: { type: 'string' }, reason: { type: 'string' } },
        required: ['status'],
      },
    },
    {
      name: 'graph_patch',
      description: '研究图增量 upsert/remove',
      payload: { type: 'object' },
    },
    {
      name: 'confirm',
      description: '硬停待确认（预算 / 扩支）',
      payload: { type: 'object' },
    },
    {
      name: 'report_ready',
      description: '结构化报告已就绪',
      payload: {
        type: 'object',
        properties: { runId: { type: 'integer' } },
        required: ['runId'],
      },
    },
    {
      name: 'log',
      description: '进度日志行',
      payload: {
        type: 'object',
        properties: { message: { type: 'string' }, at: { type: 'string' } },
        required: ['message'],
      },
    },
    {
      name: 'progress',
      description: '进度账本增量（与 GET …/progress 同源语义）',
      payload: {
        type: 'object',
        properties: {
          seq: { type: 'integer' },
          kind: { type: 'string' },
          message: { type: 'string' },
          at: { type: 'string' },
        },
      },
    },
    {
      name: 'error',
      description: '错误（对齐 ErrorEnvelope）',
      payload: {
        type: 'object',
        properties: { errorCode: { type: 'string' }, message: { type: 'string' } },
        required: ['errorCode', 'message'],
      },
    },
  ],
};

const ALL_CHANNELS = [
  QA_STREAM_CHANNEL,
  STUDIO_OUTLINE_STREAM_CHANNEL,
  STUDIO_MARKDOWN_STREAM_CHANNEL,
  RESEARCH_STREAM_CHANNEL,
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
    description = 'QA / Studio / Research 的 SSE 通道（c70 动词约定）',
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
