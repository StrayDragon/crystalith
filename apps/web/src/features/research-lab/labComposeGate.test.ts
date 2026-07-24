import { expect, test } from 'vitest';

import { DEFAULT_LAB_COMPOSE_DEPTH } from './labComposeDepth';
import { LAB_COMPOSE_BLOCK_MESSAGES, resolveLabComposeBlockReason } from './labComposeGate';

test('resolveLabComposeBlockReason requires topic and a channel', () => {
  expect(
    resolveLabComposeBlockReason({
      topic: '',
      useNotebookSources: true,
      allowWeb: true,
      selectedSourceIds: [1],
      depth: DEFAULT_LAB_COMPOSE_DEPTH,
    }),
  ).toBe('topic');

  expect(
    resolveLabComposeBlockReason({
      topic: '量子纠错',
      useNotebookSources: false,
      allowWeb: false,
      selectedSourceIds: [],
      depth: 'deep',
    }),
  ).toBe('no_channel');

  expect(
    resolveLabComposeBlockReason({
      topic: '量子纠错',
      useNotebookSources: true,
      allowWeb: false,
      selectedSourceIds: [],
      depth: 'shallow',
    }),
  ).toBe('need_sources');

  expect(
    resolveLabComposeBlockReason({
      topic: '量子纠错',
      useNotebookSources: false,
      allowWeb: true,
      selectedSourceIds: [],
      depth: DEFAULT_LAB_COMPOSE_DEPTH,
    }),
  ).toBeNull();

  expect(LAB_COMPOSE_BLOCK_MESSAGES.topic).toContain('主题');
});
