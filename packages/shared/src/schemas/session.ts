// Session schemas — `crystalith.features.sessions.schemas`
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';

export const SessionSchema = z.object({
  id: IdSchema,
  notebook_id: IdSchema,
  title: z.string().min(1).max(255).nullable(),
  shared_state: JsonMetadataSchema,
  shared_state_revision: z.number().int().nonnegative(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionCreateSchema = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
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
