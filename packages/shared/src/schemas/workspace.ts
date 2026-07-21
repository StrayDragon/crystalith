// Workspace tools API — GET /v2/workspace/tools(+/:id/config).
import { z } from 'zod';

import { desc } from './i18n.js';
import {
  FrontendBundleDescriptorSchema,
  OutputTypeSchema,
  RenderDescriptorSchema,
  StudioToneSchema,
} from './output.js';
import { PluginConfigSchema } from './studio.js';

export const WorkspaceToolSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal('outputType'),
    label: z.string(),
    description: z.string(),
    tone: StudioToneSchema,
    outputType: OutputTypeSchema,
    prompt: z.string(),
    isTool: z.boolean(),
    enabled: z.boolean(),
    configSchema: PluginConfigSchema.nullable(),
    renderDescriptor: RenderDescriptorSchema.nullable(),
    frontendBundle: FrontendBundleDescriptorSchema.nullable().optional(),
  })
  .openapi({
    description: desc('workspace.tool', 'Workspace tool（output type as tool）'),
  });
export type WorkspaceTool = z.infer<typeof WorkspaceToolSchema>;

/** Per-plugin entry under diagnostics.official (passthrough for forward-compatible keys). */
export const WorkspaceToolOfficialDiagnosticSchema = z
  .object({
    hint: z.string().nullable().optional(),
    status: z.string().optional(),
    message: z.string().nullable().optional(),
    errorCode: z.string().nullable().optional(),
  })
  .passthrough();
export type WorkspaceToolOfficialDiagnostic = z.infer<typeof WorkspaceToolOfficialDiagnosticSchema>;

/** Slides engine diagnostic blob on GET /v2/workspace/tools. */
export const WorkspaceToolsSlidesDiagnosticSchema = z
  .object({
    available: z.boolean().optional(),
    message: z.string().nullable().optional(),
    hint: z.string().nullable().optional(),
    activePluginId: z.string().nullable().optional(),
    engine: z.string().nullable().optional(),
    errorCode: z.string().nullable().optional(),
  })
  .passthrough();
export type WorkspaceToolsSlidesDiagnostic = z.infer<typeof WorkspaceToolsSlidesDiagnosticSchema>;

export const WorkspaceToolsDiagnosticsSchema = z.object({
  plugins: z.object({
    loaded: z.array(z.string()),
    skipped: z.record(z.string(), z.unknown()),
  }),
  official: z.record(z.string(), WorkspaceToolOfficialDiagnosticSchema),
  slides: WorkspaceToolsSlidesDiagnosticSchema.nullable(),
});
export type WorkspaceToolsDiagnostics = z.infer<typeof WorkspaceToolsDiagnosticsSchema>;

export const WorkspaceToolsListResponseSchema = z.object({
  tools: z.array(WorkspaceToolSchema),
  diagnostics: WorkspaceToolsDiagnosticsSchema,
});
export type WorkspaceToolsListResponse = z.infer<typeof WorkspaceToolsListResponseSchema>;

/** GET /v2/workspace/tools/:id/config — SLIDES spreads PluginConfig; others are minimal. */
export const WorkspaceToolConfigResponseSchema = z
  .object({
    toolId: z.string(),
    toolLabel: z.string(),
  })
  .catchall(z.unknown());
export type WorkspaceToolConfigResponse = z.infer<typeof WorkspaceToolConfigResponseSchema>;
