// Workspace tools router — GET /v2/workspace/tools
//
// Lists available workspace tools (output types as tools) for the frontend
// workspace command palette / tool selector. Mirrors v1 `features/workspace/api.py`.
import { Elysia, NotFoundError } from 'elysia';

import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { OUTPUT_META } from '../outputs/generator.ts';
import { buildSlidesConfigSchema } from '../studio/config.ts';

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
      // c56: SLIDES tool MUST carry config_schema to drive the frontend config UI
      // (workspace-api-contract r20). Other output types have no config UI yet.
      config_schema: type === 'SLIDES' ? buildSlidesConfigSchema() : null,
      // render_descriptor tells frontend GenericOutputRenderer how to display
      // structured output content (FAQ→cards, GUIDE→sections, MINDMAP→tree, etc.)
      // Without this, frontend falls back to raw JSON. Mirrors v1 plugin.render_descriptor.
      render_descriptor: meta.render_descriptor,
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
    // c56: /tools/:id/config MUST be consistent with the tools list config_schema
    // (workspace-api-contract r21). SLIDES returns the full SlidesConfigSchema.
    if (type === 'SLIDES') {
      return {
        tool_id: params.id,
        tool_label: meta.display_text,
        ...buildSlidesConfigSchema(),
      };
    }
    return {
      tool_id: params.id,
      tool_label: meta.display_text,
      type: meta.type,
      prompt: meta.prompt,
    };
  });
