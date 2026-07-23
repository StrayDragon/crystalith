import { expect, test } from 'vitest';

import { LAB_COMPOSE_BLOCK_MESSAGES, resolveLabComposeBlockReason } from './labComposeGate';

test('resolveLabComposeBlockReason requires topic and a channel', () => {
  expect(
    resolveLabComposeBlockReason({
      topic: '',
      useNotebookSources: true,
      allowWeb: true,
      selectedSourceIds: [1],
    }),
  ).toBe('topic');

  expect(
    resolveLabComposeBlockReason({
      topic: '量子纠错',
      useNotebookSources: false,
      allowWeb: false,
      selectedSourceIds: [],
    }),
  ).toBe('no_channel');

  expect(
    resolveLabComposeBlockReason({
      topic: '量子纠错',
      useNotebookSources: true,
      allowWeb: false,
      selectedSourceIds: [],
    }),
  ).toBe('need_sources');

  expect(
    resolveLabComposeBlockReason({
      topic: '量子纠错',
      useNotebookSources: false,
      allowWeb: true,
      selectedSourceIds: [],
    }),
  ).toBeNull();

  expect(LAB_COMPOSE_BLOCK_MESSAGES.topic).toContain('主题');
});
