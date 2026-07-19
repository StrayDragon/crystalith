// Session schemas — `crystalith.features.sessions.schemas`
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';
import { desc } from './i18n.js';

export const SessionSchema = z
  .object({
    id: IdSchema.describe(desc('session.id')),
    notebookId: IdSchema.describe(desc('session.notebook_id')),
    title: z.string().min(1).max(255).nullable().describe(desc('session.title')),
    sharedState: JsonMetadataSchema,
    sharedStateRevision: z.number().int().nonnegative(),
    createdAt: IsoTimestampSchema.describe(desc('session.created_at')),
    updatedAt: IsoTimestampSchema.describe(desc('session.updated_at')),
  })
  .openapi({
    description: desc('session.entity', 'Chat session 实体'),
    example: {
      id: 1,
      notebookId: 1,
      title: 'Session',
      sharedState: {},
      sharedStateRevision: 0,
      createdAt: '2026-07-08T12:00:00.000Z',
      updatedAt: '2026-07-08T12:00:00.000Z',
    },
  });
export type Session = z.infer<typeof SessionSchema>;

export const SessionCreateSchema = z.object({
  title: z.string().min(1).max(255).nullable().optional().describe(desc('session.title')),
});
export type SessionCreate = z.infer<typeof SessionCreateSchema>;

export const SessionUpdateSchema = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  /** Optimistic-concurrency: only apply if server revision matches. */
  sharedStateRevision: z.number().int().nonnegative().optional(),
  sharedState: JsonMetadataSchema.optional(),
});
export type SessionUpdate = z.infer<typeof SessionUpdateSchema>;

export const SessionListSchema = z.object({
  sessions: z.array(SessionSchema),
});

/** POST …/sessions/:sid/convert-to-source */
export const SessionConvertToSourceRequestSchema = z
  .object({
    messageIds: z.array(IdSchema).min(1).optional(),
  })
  .default({});
export type SessionConvertToSourceRequest = z.infer<typeof SessionConvertToSourceRequestSchema>;

export const SessionConvertToSourceResponseSchema = z.object({
  sourceId: IdSchema,
  filename: z.string(),
  chunkCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
});
export type SessionConvertToSourceResponse = z.infer<typeof SessionConvertToSourceResponseSchema>;

/** POST …/sessions/:sid/convert-to-output */
export const SessionConvertToOutputRequestSchema = z.object({
  outputType: z.enum(['PARAGRAPH', 'BULLETS', 'STRUCTURED']),
  messageIds: z.array(IdSchema).min(1).optional(),
});
export type SessionConvertToOutputRequest = z.infer<typeof SessionConvertToOutputRequestSchema>;

export const SessionConvertToOutputResponseSchema = z.object({
  outputId: IdSchema,
  outputType: z.enum(['PARAGRAPH', 'BULLETS', 'STRUCTURED']),
  title: z.string(),
  messageCount: z.number().int().nonnegative(),
});
export type SessionConvertToOutputResponse = z.infer<typeof SessionConvertToOutputResponseSchema>;
