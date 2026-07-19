// Workspace tools API — GET /v2/workspace/tools(+/:id/config).
import { z } from 'zod';

import {
  FrontendBundleDescriptorSchema,
  OutputTypeSchema,
  RenderDescriptorSchema,
  StudioToneSchema,
} from './output.js';
import { PluginConfigSchema } from './studio.js';

export const WorkspaceToolSchema = z.object({
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
});
export type WorkspaceTool = z.infer<typeof WorkspaceToolSchema>;

export const WorkspaceToolsDiagnosticsSchema = z.object({
  plugins: z.object({
    loaded: z.array(z.string()),
    skipped: z.record(z.string(), z.unknown()),
  }),
  official: z.record(z.string(), z.unknown()),
  slides: z.unknown().nullable(),
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
