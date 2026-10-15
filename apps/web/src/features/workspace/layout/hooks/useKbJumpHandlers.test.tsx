// c132 output-jump fetch-then-open — same-notebook jumps revalidate the
// mounted outputs key; cross-notebook jumps seed the TARGET notebook's key
// (a same-tick bound mutate would hit the previous notebook's key) and the
// viewer opens even when the seeding fetch fails (recovery effect tolerates
// loading/errored lists).
import { expect, test, rs } from '@rstest/core';
import { act } from '@testing-library/react';

import { renderHook } from '../../../../test-utils/renderHook';
import { useKbJumpHandlers } from './useKbJumpHandlers';

function setup(activeNotebookId: number | null) {
  const deps = {
    sourceById: new Map(),
    openCitationSourceDetail: rs.fn(),
    setJumpToCitationChunkId: rs.fn(),
    openOutputViewer: rs.fn(),
    refreshOutputs: rs.fn(async () => undefined),
    fetchOutputsFor: rs.fn(async (_nid: number) => undefined),
    activeNotebookId,
    setActiveNotebook: rs.fn((id: number | null) => id),
  };
  const { result } = renderHook(() => useKbJumpHandlers(deps));
  return { result, deps };
}

test('cross-notebook jump seeds the target notebook key, not the mounted one', async () => {
  const { result, deps } = setup(1);

  await act(async () => {
    await result.current.jumpToOutput(9, 2);
  });

  expect(deps.setActiveNotebook).toHaveBeenCalledWith(2);
  expect(deps.fetchOutputsFor).toHaveBeenCalledWith(2);
  expect(deps.refreshOutputs).not.toHaveBeenCalled();
  expect(deps.openOutputViewer).toHaveBeenCalledWith(9);
});

test('same-notebook jump revalidates the mounted outputs key', async () => {
  const { result, deps } = setup(1);

  await act(async () => {
    await result.current.jumpToOutput(9, 1);
  });

  expect(deps.refreshOutputs).toHaveBeenCalled();
  expect(deps.fetchOutputsFor).not.toHaveBeenCalled();
  expect(deps.setActiveNotebook).not.toHaveBeenCalled();
  expect(deps.openOutputViewer).toHaveBeenCalledWith(9);
});

test('viewer still opens when the target-key seeding fetch fails', async () => {
  const { result, deps } = setup(1);
  deps.fetchOutputsFor.mockImplementation(async () => {
    throw new Error('network down');
  });

  await act(async () => {
    await result.current.jumpToOutput(9, 2);
  });

  expect(deps.openOutputViewer).toHaveBeenCalledWith(9);
});
