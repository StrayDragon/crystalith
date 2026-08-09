/**
 * c104/c108 race guards: budget confirm must not clobber live reexpand;
 * finishWaveOrSynthesize must yield when already paused for user confirm.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [
    {
      title: 'Mock Web Result',
      url: 'https://example.com/mock',
      snippet: 'Mock snippet',
      source: 'mock',
    },
  ],
  webSearchTool: () => ({}),
}));

import {
  getOrm,
  installAiMock,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

installAiMock({ text: 'mocked' });
seedChatModel();

import { notebooks } from '../../src/db/schema.ts';
import { createRun } from '../../src/features/research/commands.ts';
import {
  getGraph,
  persistGraph,
  requireFresh,
  updateRun,
} from '../../src/features/research/research-core.ts';
import { enterConfirm, finishWaveOrSynthesize } from '../../src/features/research/run-loop.ts';

let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'research-race-guards' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

describe('research race guards (c104/c108)', () => {
  it('enterConfirm(budget) does not clobber live reexpand confirm', async () => {
    const created = createRun(notebookId, {
      topic: 'race enterConfirm no-clobber',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'shallow',
    });
    updateRun(created.id, {
      status: 'awaiting_confirm',
      confirmKind: 'reexpand',
      confirmBranchNodeId: 'node_focus',
      llmActivity: null,
    });

    await enterConfirm(created.id, 'budget');

    const row = requireFresh(created.id);
    expect(row.status).toBe('awaiting_confirm');
    expect(row.confirmKind).toBe('reexpand');
    expect(row.confirmBranchNodeId).toBe('node_focus');
  });

  it('finishWaveOrSynthesize yields to awaiting_confirm(reexpand) instead of budget', async () => {
    const created = createRun(notebookId, {
      topic: 'race finishWave reexpand wins',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'shallow',
    });
    const graph = getGraph(requireFresh(created.id));
    graph.nodes.push({
      id: 'node_research_pending',
      role: 'research',
      title: 'Pending',
      conclusionStatus: 'pending',
      evidenceIds: [],
      phase: 'idle',
    });
    persistGraph(created.id, graph);
    updateRun(created.id, {
      status: 'awaiting_confirm',
      confirmKind: 'reexpand',
      searchesUsed: created.maxSearches,
      allowWeb: true,
      llmActivity: null,
    });

    await finishWaveOrSynthesize(created.id);

    const row = requireFresh(created.id);
    expect(row.status).toBe('awaiting_confirm');
    expect(row.confirmKind).toBe('reexpand');
  });
});
