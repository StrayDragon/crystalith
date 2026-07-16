// Session schemas — `crystalith.features.sessions.schemas`
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';
import { desc } from './i18n.js';

export const SessionSchema = z.object({
  id: IdSchema.describe(desc('session.id')),
  notebook_id: IdSchema.describe(desc('session.notebook_id')),
  title: z.string().min(1).max(255).nullable().describe(desc('session.title')),
  shared_state: JsonMetadataSchema,
  shared_state_revision: z.number().int().nonnegative(),
  created_at: IsoTimestampSchema.describe(desc('session.created_at')),
  updated_at: IsoTimestampSchema.describe(desc('session.updated_at')),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionCreateSchema = z.object({
  title: z.string().min(1).max(255).nullable().optional().describe(desc('session.title')),
});
export type SessionCreate = z.infer<typeof SessionCreateSchema>;

export const SessionUpdateSchema = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  /** Optimistic-concurrency: only apply if server revision matches. */
  shared_state_revision: z.number().int().nonnegative().optional(),
  shared_state: JsonMetadataSchema.optional(),
});
export type SessionUpdate = z.infer<typeof SessionUpdateSchema>;

export const SessionListSchema = z.object({
  sessions: z.array(SessionSchema),
});
