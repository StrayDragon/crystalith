// Eval dataset CRUD — manage golden datasets for benchmark evaluation.
//
// Datasets contain items (question + expected_answer + expected_sources).
// Supports JSON import/export for sharing golden datasets across instances.
import { eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { evalDatasets, evalItems } from '../../db/schema.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DatasetItem {
  question: string;
  expectedAnswer: string;
  expectedSources?: number[];
  notebookId: number;
}

export interface Dataset {
  id: number;
  name: string;
  description?: string | null;
  notebookId?: number | null;
  itemCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Create a dataset + its items. */
export function createDataset(name: string, items: DatasetItem[], description?: string): number {
  const dataset = db()
    .insert(evalDatasets)
    .values({
      name,
      description: description ?? null,
      notebookId: items[0]?.notebookId ?? null,
    })
    .returning()
    .get();

  for (const item of items) {
    db()
      .insert(evalItems)
      .values({
        datasetId: dataset.id,
        question: item.question,
        expectedAnswer: item.expectedAnswer,
        expectedSources: item.expectedSources ?? null,
        notebookId: item.notebookId,
      })
      .run();
  }

  return dataset.id;
}

/** List all datasets with item counts. */
export function listDatasets(): Dataset[] {
  const rows = db().select().from(evalDatasets).all();
  return rows.map((r) => {
    const items = db().select().from(evalItems).where(eq(evalItems.datasetId, r.id)).all();
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      notebookId: r.notebookId,
      itemCount: items.length,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Get a dataset with all its items. */
export function getDataset(id: number) {
  const ds = db().select().from(evalDatasets).where(eq(evalDatasets.id, id)).get();
  if (!ds) return null;

  const items = db().select().from(evalItems).where(eq(evalItems.datasetId, id)).all();

  return {
    id: ds.id,
    name: ds.name,
    description: ds.description,
    notebookId: ds.notebookId,
    createdAt: ds.createdAt.toISOString(),
    updatedAt: ds.updatedAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      question: i.question,
      expectedAnswer: i.expectedAnswer,
      expectedSources: i.expectedSources,
      notebookId: i.notebookId,
    })),
  };
}

/** Delete a dataset + all items + runs. */
export function deleteDataset(id: number): boolean {
  const ds = db().select().from(evalDatasets).where(eq(evalDatasets.id, id)).get();
  if (!ds) return false;
  db().delete(evalDatasets).where(eq(evalDatasets.id, id)).run();
  return true;
}

/** Import dataset from JSON array. */
export function importDataset(name: string, items: DatasetItem[], description?: string): number {
  return createDataset(name, items, description);
}

/** Export dataset to portable JSON. */
export function exportDataset(id: number) {
  const ds = getDataset(id);
  if (!ds) return null;
  return {
    name: ds.name,
    description: ds.description,
    items: ds.items.map((i) => ({
      question: i.question,
      expectedAnswer: i.expectedAnswer,
      expectedSources: i.expectedSources,
      notebookId: i.notebookId,
    })),
  };
}
