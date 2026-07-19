// Eval router — /v2/eval CRUD + run evaluation.
//
// Exposes dataset management and eval execution. The CLI (bun run eval)
// can call these endpoints or use the same functions directly.
import {
  EvalDatasetCreatedResponseSchema,
  EvalDatasetSummarySchema,
  EvalDatasetUpsertRequestSchema,
  EvalRunRequestSchema,
  EvalRunResultSchema,
  EvalRunSchema,
} from '@crystalith/shared';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { evalRuns } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import {
  createDataset,
  listDatasets,
  getDataset,
  deleteDataset,
  importDataset,
  exportDataset,
} from './dataset.ts';
import { runEval } from './runner.ts';

// ---------------------------------------------------------------------------
// OpenAPI docs
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/eval/datasets',
    method: 'get',
    summary: 'List eval datasets',
    tags: ['eval'],
    responses: { 200: { description: 'Dataset list', body: EvalDatasetSummarySchema.array() } },
  },
  {
    path: '/v2/eval/datasets',
    method: 'post',
    summary: 'Create or import a dataset',
    tags: ['eval'],
    responses: { 201: { description: 'Created dataset', body: EvalDatasetCreatedResponseSchema } },
  },
  {
    path: '/v2/eval/datasets/:id',
    method: 'get',
    summary: 'Get dataset with items',
    tags: ['eval'],
    responses: { 200: { description: 'Dataset details' } },
  },
  {
    path: '/v2/eval/datasets/:id',
    method: 'delete',
    summary: 'Delete a dataset',
    tags: ['eval'],
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/eval/runs',
    method: 'get',
    summary: 'List eval runs',
    tags: ['eval'],
    responses: { 200: { description: 'Run list', body: EvalRunSchema.array() } },
  },
  {
    path: '/v2/eval/runs',
    method: 'post',
    summary: 'Run evaluation',
    tags: ['eval'],
    responses: { 200: { description: 'Eval results', body: EvalRunResultSchema } },
  },
];

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const evalRouter = new Elysia({ prefix: '/v2' })
  // List datasets
  .get('/eval/datasets', () => listDatasets(), {
    response: EvalDatasetSummarySchema.array(),
  })

  // Create dataset
  .post(
    '/eval/datasets',
    ({ body, set }) => {
      const items = body.items.map((item) => ({
        question: item.question,
        expectedAnswer: item.expectedAnswer,
        expectedSources: item.expectedSources ?? undefined,
        notebookId: item.notebookId,
      }));
      const id = createDataset(body.name, items, body.description);
      set.status = 201;
      return { id, name: body.name };
    },
    { body: EvalDatasetUpsertRequestSchema, response: EvalDatasetCreatedResponseSchema },
  )

  // Get dataset
  .get('/eval/datasets/:id', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'dataset id');
    const ds = getDataset(id);
    if (!ds) throw new NotFoundError(`Dataset ${params.id} not found`);
    return ds;
  })

  // Delete dataset
  .delete('/eval/datasets/:id', ({ params, set }) => {
    const id = requirePositiveIntId(params.id, 'dataset id');
    const ok = deleteDataset(id);
    if (!ok) throw new NotFoundError(`Dataset ${params.id} not found`);
    set.status = 204;
    return '';
  })

  // Import dataset (JSON body with items array)
  .post(
    '/eval/datasets/import',
    ({ body }) => {
      const items = body.items.map((item) => ({
        question: item.question,
        expectedAnswer: item.expectedAnswer,
        expectedSources: item.expectedSources ?? undefined,
        notebookId: item.notebookId,
      }));
      const id = importDataset(body.name, items, body.description);
      return { id, name: body.name };
    },
    { body: EvalDatasetUpsertRequestSchema, response: EvalDatasetCreatedResponseSchema },
  )

  // Export dataset
  .get('/eval/datasets/:id/export', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'dataset id');
    const data = exportDataset(id);
    if (!data) throw new NotFoundError(`Dataset ${params.id} not found`);
    return data;
  })

  // List runs
  .get(
    '/eval/runs',
    () => {
      return db()
        .select()
        .from(evalRuns)
        .orderBy(evalRuns.startedAt)
        .all()
        .map((r) => ({
          id: r.id,
          datasetId: r.datasetId,
          strategyIds: r.strategyIds as string[],
          status: r.status,
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt?.toISOString() ?? null,
          summary: (r.summary as Record<string, unknown> | null) ?? null,
        }));
    },
    { response: EvalRunSchema.array() },
  )

  // Run evaluation
  .post(
    '/eval/runs',
    async ({ body }) => {
      return runEval(body.datasetId, body.strategyIds);
    },
    { body: EvalRunRequestSchema, response: EvalRunResultSchema },
  );

registerApiDoc(apiDocs);
