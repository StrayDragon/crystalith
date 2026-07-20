// Workspace tools router — GET /v2/workspace/tools
//
// Lists available workspace tools (output types as tools) for the frontend
// workspace command palette / tool selector. Mirrors v1 `features/workspace/api.py`.
// Wire fields are camelCase (c65).
import {
  OutputTypeSchema,
  StudioToneSchema,
  WorkspaceToolConfigResponseSchema,
  WorkspaceToolsListResponseSchema,
} from '@crystalith/shared';
import { Elysia, NotFoundError } from 'elysia';

import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { OUTPUT_META, FRONTEND_BUNDLES } from '../outputs/generator.ts';
import { buildSlidesConfigSchema } from '../studio/config.ts';

const FRONTEND_BUNDLE_BY_TYPE: Record<
  string,
  (typeof FRONTEND_BUNDLES)[keyof typeof FRONTEND_BUNDLES]
> = FRONTEND_BUNDLES;

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/workspace/tools',
    method: 'get',
    summary: 'List workspace tools (output types as tools)',
    tags: ['workspace'],
    responses: {
      200: { description: 'Tool list with metadata', body: WorkspaceToolsListResponseSchema },
    },
  },
  {
    path: '/v2/workspace/tools/:id/config',
    method: 'get',
    summary: 'Get tool config by ID',
    tags: ['workspace'],
    responses: {
      200: { description: 'Tool config', body: WorkspaceToolConfigResponseSchema },
    },
  },
];

registerApiDoc(apiDocs);

export const workspaceRouter = new Elysia({ prefix: '/v2' })
  .get(
    '/workspace/tools',
    () => {
      const tools = Object.entries(OUTPUT_META).map(([type, meta]) => ({
        id: type.toLowerCase(),
        kind: 'outputType' as const,
        label: meta.displayText,
        description: meta.description,
        tone: StudioToneSchema.parse(meta.tone),
        outputType: OutputTypeSchema.parse(type),
        prompt: meta.prompt,
        isTool: meta.isTool,
        enabled: true,
        // c56: SLIDES tool MUST carry configSchema to drive the frontend config UI
        configSchema: type === 'SLIDES' ? buildSlidesConfigSchema() : null,
        // renderDescriptor tells frontend GenericOutputRenderer how to display
        // structured output content (FAQ→cards, GUIDE→sections, MINDMAP→tree, etc.)
        renderDescriptor: meta.renderDescriptor,
        frontendBundle: FRONTEND_BUNDLE_BY_TYPE[type] ?? null,
      }));

      return {
        tools,
        diagnostics: {
          plugins: { loaded: tools.map((t) => t.id), skipped: {} },
          official: {},
          slides: null,
        },
      };
    },
    { response: WorkspaceToolsListResponseSchema },
  )

  .get(
    '/workspace/tools/:id/config',
    ({ params }) => {
      const type = params.id.toUpperCase();
      const meta = OUTPUT_META[type];
      if (!meta) throw new NotFoundError(`Tool ${params.id} not found`);
      // c56: /tools/:id/config MUST be consistent with the tools list configSchema
      if (type === 'SLIDES') {
        return {
          toolId: params.id,
          toolLabel: meta.displayText,
          ...buildSlidesConfigSchema(),
        };
      }
      return {
        toolId: params.id,
        toolLabel: meta.displayText,
        type: meta.type,
        prompt: meta.prompt,
      };
    },
    { response: WorkspaceToolConfigResponseSchema },
  );
