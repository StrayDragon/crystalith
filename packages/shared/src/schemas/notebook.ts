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

/** Optional `?templateId=` on POST /v2/notebooks (apply template sessions/tags on create). */
export const NotebookCreateQuerySchema = z
  .object({
    templateId: z.coerce.number().int().positive().optional(),
  })
  .openapi({
    description: desc('notebook.create_query', '创建 Notebook 可选查询参数'),
  });
export type NotebookCreateQuery = z.infer<typeof NotebookCreateQuerySchema>;

export const NotebookUpdateSchema = z
  .object({
    name: z.string().min(1).max(255),
  })
  .openapi({
    description: desc('notebook.update', '更新 Notebook 请求'),
    example: { name: 'Renamed' },
  });
export type NotebookUpdate = z.infer<typeof NotebookUpdateSchema>;

/** List response: `{ notebooks: Notebook[] }` (envelope shape carried over from v1). */
export const NotebookListSchema = z.object({
  notebooks: z.array(NotebookSchema),
});

export const NotebookRef = TimestampsSchema;
