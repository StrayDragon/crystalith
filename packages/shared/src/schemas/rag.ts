// RAG strategy registry wire schemas — /v2/strategies + per-notebook config.
import { z } from 'zod';

import { IdSchema } from './common.js';

export const RagStrategyInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
});
export type RagStrategyInfo = z.infer<typeof RagStrategyInfoSchema>;

export const NotebookStrategiesResponseSchema = z.object({
  notebookId: IdSchema,
  strategies: z.array(z.string()),
});
export type NotebookStrategiesResponse = z.infer<typeof NotebookStrategiesResponseSchema>;

/** POST /v2/notebooks/:nid/strategies */
export const NotebookStrategiesSetRequestSchema = z.object({
  strategies: z.array(z.string()),
});
export type NotebookStrategiesSetRequest = z.infer<typeof NotebookStrategiesSetRequestSchema>;
