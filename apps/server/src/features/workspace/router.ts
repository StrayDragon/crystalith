// Workspace tools router — GET /v2/workspace/tools
//
// Lists available workspace tools (output types as tools) for the frontend
// workspace command palette / tool selector. Mirrors v1 `features/workspace/api.py`.
import { Elysia, NotFoundError } from 'elysia';

import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { OUTPUT_META } from '../outputs/generator.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/workspace/tools',
    method: 'get',
    summary: 'List workspace tools (output types as tools)',
    tags: ['workspace'],
    responses: { 200: { description: 'Tool list with metadata' } },
  },
  {
    path: '/v2/workspace/tools/:id/config',
    method: 'get',
    summary: 'Get tool config by ID',
    tags: ['workspace'],
    responses: { 200: { description: 'Tool config' } },
  },
];

registerApiDoc(apiDocs);

export const workspaceRouter = new Elysia({ prefix: '/v2' })
  .get('/workspace/tools', () => {
    const tools = Object.entries(OUTPUT_META).map(([type, meta]) => ({
      id: type.toLowerCase(),
      kind: 'output_type',
      label: meta.display_text,
      description: meta.description,
      tone: meta.tone,
      output_type: type,
      prompt: meta.prompt,
      is_tool: meta.is_tool,
      enabled: true,
    }));

    return {
      tools,
      diagnostics: {
        plugins: { loaded: tools.map((t) => t.id), skipped: {} },
        official: {},
        slides: null,
      },
    };
  })

  .get('/workspace/tools/:id/config', ({ params }) => {
    const type = params.id.toUpperCase();
    const meta = OUTPUT_META[type];
    if (!meta) throw new NotFoundError(`Tool ${params.id} not found`);
    return {
      tool_id: params.id,
      tool_label: meta.display_text,
      type: meta.type,
      prompt: meta.prompt,
    };
  });
