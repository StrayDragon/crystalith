// Drizzle schema barrel — per-domain modules live in `schema/`.
//
// Pure re-export surface: importers keep using `../db/schema.ts` unchanged.
// Domain modules own their tables + within-domain relations; the two
// cross-domain `many()` relations (notebooks hub, outputs→slides) live here
// where every table is already imported. The sqlite-vec `vec_chunks` virtual
// table is NOT managed by Drizzle (see `vectors.ts`).
//
// The table map below is what `drizzle({ schema })` consumes for relational
// queries — keep it in sync with the re-exports when adding a table.
import { relations } from 'drizzle-orm';

import { notebooks, notebookExtractorPolicies, strategyConfigs } from './schema/notebooks.ts';
import { outputs } from './schema/outputs.ts';
import {
  researchEvidences,
  researchProgressEvents,
  researchReportEdits,
  researchRevisions,
  researchRuns,
} from './schema/research.ts';
import { messages, sessions } from './schema/sessions.ts';
import {
  chunks,
  sourceConnectorBindings,
  sourceTagMap,
  sourceTags,
  sources,
} from './schema/sources.ts';
import { studioSlides } from './schema/studio.ts';
import { promptPresets, templates } from './schema/templates.ts';

export {
  notebooks,
  notebookExtractorPolicies,
  strategyConfigs,
  strategyConfigRelations,
} from './schema/notebooks.ts';
export { promptPresets, templates } from './schema/templates.ts';
export { sessions, sessionRelations, messages, messageRelations } from './schema/sessions.ts';
export {
  sources,
  sourceRelations,
  chunks,
  chunkRelations,
  sourceTags,
  sourceTagRelations,
  sourceTagMap,
  sourceTagMapRelations,
  sourceConnectorBindings,
  sourceConnectorBindingRelations,
} from './schema/sources.ts';
export { outputs } from './schema/outputs.ts';
export { studioSlides, studioSlideRelations } from './schema/studio.ts';
export {
  researchRuns,
  researchEvidences,
  researchRevisions,
  researchReportEdits,
  researchProgressEvents,
  researchRunRelations,
  researchEvidenceRelations,
  researchRevisionRelations,
  researchReportEditRelations,
  researchProgressEventRelations,
} from './schema/research.ts';
export type {
  ResearchGraphJson,
  ResearchCheckpointJson,
  ResearchReportJson,
} from './schema/research.ts';

// ---------------------------------------------------------------------------
// Cross-domain relations (hub `many()` sides)
// ---------------------------------------------------------------------------

export const notebookRelations = relations(notebooks, ({ many }) => ({
  sources: many(sources),
  sourceTags: many(sourceTags),
  sessions: many(sessions),
  outputs: many(outputs),
  sourceConnectorBindings: many(sourceConnectorBindings),
  extractorPolicy: many(notebookExtractorPolicies),
  studioSlides: many(studioSlides),
  strategyConfigs: many(strategyConfigs),
  researchRuns: many(researchRuns),
}));

export const outputRelations = relations(outputs, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [outputs.notebookId], references: [notebooks.id] }),
  slides: many(studioSlides),
}));

// ---------------------------------------------------------------------------
// Table map passed to `drizzle({ schema })` for relational queries
// ---------------------------------------------------------------------------

export const schema = {
  notebooks,
  notebookExtractorPolicies,
  strategyConfigs,
  templates,
  promptPresets,
  sessions,
  messages,
  sources,
  chunks,
  sourceTags,
  sourceTagMap,
  sourceConnectorBindings,
  outputs,
  studioSlides,
  researchRuns,
  researchEvidences,
  researchRevisions,
  researchReportEdits,
  researchProgressEvents,
};

export type Schema = typeof schema;
