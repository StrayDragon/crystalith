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
import type { SlidesWorkflowImpl } from '../../plugins/builtin/slides-slidev.ts';
import { pluginRegistry } from '../../plugins/registry.ts';
import { OUTPUT_META, FRONTEND_BUNDLES } from '../outputs/generator.ts';

const FRONTEND_BUNDLE_BY_TYPE: Record<
  string,
  (typeof FRONTEND_BUNDLES)[keyof typeof FRONTEND_BUNDLES]
> = FRONTEND_BUNDLES;

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/workspace/tools',
    method: 'get',
    summary: '列出 Workspace 工具（产出类型即工具）',
    tags: ['workspace'],
    responses: {
      200: { description: '工具列表', body: WorkspaceToolsListResponseSchema },
    },
  },
  {
    path: '/v2/workspace/tools/:id/config',
    method: 'get',
    summary: '按 id 获取工具配置 schema',
    tags: ['workspace'],
    responses: {
      200: { description: '工具配置', body: WorkspaceToolConfigResponseSchema },
    },
  },
];

registerApiDoc(apiDocs);

export const workspaceRouter = new Elysia({ prefix: '/v2' })
  .get(
    '/workspace/tools',
    async () => {
      await pluginRegistry.ensureLoaded();
      const slidesImpl = pluginRegistry.implOf<SlidesWorkflowImpl>('slides-slidev');
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
        configSchema: type === 'SLIDES' ? (slidesImpl?.buildSlidesConfigSchema() ?? null) : null,
        // renderDescriptor tells frontend GenericOutputRenderer how to display
        // structured output content (FAQ→cards, GUIDE→sections, MINDMAP→tree, etc.)
        renderDescriptor: meta.renderDescriptor,
        frontendBundle: FRONTEND_BUNDLE_BY_TYPE[type] ?? null,
      }));

      const report = pluginRegistry.loadReport();
      // r18: official catalog covers every registered official plugin
      // (built-ins ship in-box; @crystalith-plugin/* installs report their source)
      const official = Object.fromEntries(
        pluginRegistry.allRegistrations().map(({ plugin, source }) => [
          plugin.id,
          {
            status: source === 'builtin' ? 'builtin' : 'installed',
            message: plugin.displayName,
          },
        ]),
      );

      return {
        tools,
        diagnostics: {
          plugins: report,
          official,
          slides: null,
        },
      };
    },
    { response: WorkspaceToolsListResponseSchema },
  )

  .get(
    '/workspace/tools/:id/config',
    async ({ params }) => {
      await pluginRegistry.ensureLoaded();
      const type = params.id.toUpperCase();
      const meta = OUTPUT_META[type];
      if (!meta) throw new NotFoundError(`Tool ${params.id} not found`);
      // c56: /tools/:id/config MUST be consistent with the tools list configSchema
      if (type === 'SLIDES') {
        const slidesImpl = pluginRegistry.implOf<SlidesWorkflowImpl>('slides-slidev');
        if (slidesImpl) {
          return {
            toolId: params.id,
            toolLabel: meta.displayText,
            ...slidesImpl.buildSlidesConfigSchema(),
          };
        }
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
