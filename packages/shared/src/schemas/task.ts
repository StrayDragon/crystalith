// Task schemas — background job queue (refine, document_parse).
// Mirrors v1 `shared.db.models.Task` + `features.tasks`.
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, JsonMetadataSchema } from './common.js';

export const TaskTypeSchema = z.enum(['refine', 'document_parse']);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const TaskStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: IdSchema,
  notebook_id: IdSchema.nullable().optional(),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  payload: JsonMetadataSchema,
  result: JsonMetadataSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  progress: z.number().int().min(0).max(100).default(0),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskListSchema = z.object({
  tasks: z.array(TaskSchema),
});
