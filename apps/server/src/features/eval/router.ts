// Eval router — /v2/eval CRUD + run evaluation.
//
// Exposes dataset management and eval execution. The CLI (bun run eval)
// can call these endpoints or use the same functions directly.
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
    responses: { 200: { description: 'Dataset list' } },
  },
  {
    path: '/v2/eval/datasets',
    method: 'post',
    summary: 'Create or import a dataset',
    tags: ['eval'],
    responses: { 201: { description: 'Created dataset' } },
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
    responses: { 200: { description: 'Run list' } },
  },
  {
    path: '/v2/eval/runs',
    method: 'post',
    summary: 'Run evaluation',
    tags: ['eval'],
    responses: { 200: { description: 'Eval results' } },
  },
];

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const evalRouter = new Elysia({ prefix: '/v2' })
  // List datasets
  .get('/eval/datasets', () => listDatasets())

  // Create dataset
  .post('/eval/datasets', ({ body }) => {
    const { name, items, description } = body as {
      name: string;
      items: import('./dataset.ts').DatasetItem[];
      description?: string;
    };
    const id = createDataset(name, items, description);
    return { id, name };
  })

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
  .post('/eval/datasets/import', ({ body }) => {
    const { name, items, description } = body as {
      name: string;
      items: import('./dataset.ts').DatasetItem[];
      description?: string;
    };
    const id = importDataset(name, items, description);
    return { id, name };
  })

  // Export dataset
  .get('/eval/datasets/:id/export', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'dataset id');
    const data = exportDataset(id);
    if (!data) throw new NotFoundError(`Dataset ${params.id} not found`);
    return data;
  })

  // List runs
  .get('/eval/runs', () => {
    return db()
      .select()
      .from(evalRuns)
      .orderBy(evalRuns.startedAt)
      .all()
      .map((r) => ({
        id: r.id,
        dataset_id: r.datasetId,
        strategy_ids: r.strategyIds,
        status: r.status,
        started_at: r.startedAt?.toISOString(),
        finished_at: r.finishedAt?.toISOString(),
        summary: r.summary,
      }));
  })

  // Run evaluation
  .post('/eval/runs', async ({ body }) => {
    const { dataset_id, strategy_ids } = body as {
      dataset_id: number;
      strategy_ids: string[];
    };
    const result = await runEval(dataset_id, strategy_ids);
    return result;
  });

registerApiDoc(apiDocs);
