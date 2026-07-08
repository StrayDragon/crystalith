// Notebook schemas — `crystalith.features.notebooks.schemas`
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, TimestampsSchema } from './common.js';

export const NotebookSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(255),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Notebook = z.infer<typeof NotebookSchema>;

export const NotebookCreateSchema = z.object({
  name: z.string().min(1).max(255),
});
export type NotebookCreate = z.infer<typeof NotebookCreateSchema>;

export const NotebookUpdateSchema = z.object({
  name: z.string().min(1).max(255),
});
export type NotebookUpdate = z.infer<typeof NotebookUpdateSchema>;

/** List response: `{ notebooks: Notebook[] }` (kept for v1 compat during migration). */
export const NotebookListSchema = z.object({
  notebooks: z.array(NotebookSchema),
});

export const NotebookRef = TimestampsSchema;
