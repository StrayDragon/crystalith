// Notebook schemas — `crystalith.features.notebooks.schemas`
import { z } from 'zod';

import { IdSchema, IsoTimestampSchema, TimestampsSchema } from './common.js';
import { desc } from './i18n.js';

export const NotebookSchema = z
  .object({
    id: IdSchema.describe(desc('notebook.id')),
    name: z.string().min(1).max(255).describe(desc('notebook.name')),
    createdAt: IsoTimestampSchema.describe(desc('notebook.created_at')),
    updatedAt: IsoTimestampSchema.describe(desc('notebook.updated_at')),
  })
  .openapi({
    description: desc('notebook.entity', 'Notebook 实体'),
    example: {
      id: 1,
      name: 'Demo',
      createdAt: '2026-07-08T12:00:00.000Z',
      updatedAt: '2026-07-08T12:00:00.000Z',
    },
  });
export type Notebook = z.infer<typeof NotebookSchema>;

export const NotebookCreateSchema = z
  .object({
    name: z.string().min(1).max(255).describe(desc('notebook.name')),
  })
  .openapi({
    description: desc('notebook.create', '创建 Notebook 请求'),
    example: { name: 'Demo' },
  });
export type NotebookCreate = z.infer<typeof NotebookCreateSchema>;

export const NotebookUpdateSchema = z
  .object({
    name: z.string().min(1).max(255),
  })
  .openapi({
    description: desc('notebook.update', '更新 Notebook 请求'),
    example: { name: 'Renamed' },
  });
export type NotebookUpdate = z.infer<typeof NotebookUpdateSchema>;

/** List response: `{ notebooks: Notebook[] }` (kept for v1 compat during migration). */
export const NotebookListSchema = z.object({
  notebooks: z.array(NotebookSchema),
});

export const NotebookRef = TimestampsSchema;
