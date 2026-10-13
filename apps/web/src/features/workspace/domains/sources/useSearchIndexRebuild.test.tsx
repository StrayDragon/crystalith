// c131 T6 — useSearchIndexRebuild: status polling (1s while rebuilding) and
// rebuild start (202 handle). MSW-mocked endpoints, SWR-free plain hook.
import { beforeEach, expect, test } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useSearchIndexRebuild } from './useSearchIndexRebuild';

const STATUS_READY = {
  state: 'ready',
  lastJob: { id: 1, mode: 'notebook', state: 'succeeded', total: 2, done: 2, failed: 0 },
};
const STATUS_REBUILDING = {
  state: 'rebuilding',
  jobId: 2,
  progress: { total: 4, done: 1, failed: 0 },
};

let rebuildStarts = 0;

beforeEach(() => {
  rebuildStarts = 0;
});

test('polls status and exposes the rebuilding state with progress', async () => {
  let phase: 'rebuilding' | 'ready' = 'rebuilding';
  server.use(
    http.get('*/v2/notebooks/:nid/search-index', () =>
      HttpResponse.json(phase === 'rebuilding' ? STATUS_REBUILDING : STATUS_READY),
    ),
  );

  const { result } = renderHook(() => useSearchIndexRebuild(7));
  await waitFor(() => expect(result.current.indexStatus?.state).toBe('rebuilding'));
  expect(result.current.indexStatus?.progress?.total).toBe(4);

  phase = 'ready';
  await waitFor(() => expect(result.current.indexStatus?.state).toBe('ready'), { timeout: 3000 });
  expect(result.current.statusError).toBeNull();
});

test('startRebuild posts once, refreshes status and surfaces conflicts as errors', async () => {
  server.use(
    http.get('*/v2/notebooks/:nid/search-index', () => HttpResponse.json(STATUS_READY)),
    http.post('*/v2/notebooks/:nid/search-index/rebuild', () => {
      rebuildStarts += 1;
      return HttpResponse.json({ jobId: 9, mode: 'notebook' }, { status: 202 });
    }),
  );

  const { result } = renderHook(() => useSearchIndexRebuild(7));
  await waitFor(() => expect(result.current.indexStatus?.state).toBe('ready'));

  await act(async () => {
    await result.current.startRebuild();
  });
  expect(rebuildStarts).toBe(1);
  expect(result.current.control?.starting).toBe(false);

  // 409 while already running → surfaced via statusError, not thrown.
  server.use(
    http.post('*/v2/notebooks/:nid/search-index/rebuild', () =>
      HttpResponse.json({ errorCode: 'CONFLICT', message: '重建任务正在进行' }, { status: 409 }),
    ),
  );
  await act(async () => {
    await result.current.startRebuild();
  });
  expect(rebuildStarts).toBe(1);
  expect(result.current.statusError).toContain('重建');
});

test('no notebook → no polling, no requests', async () => {
  let hits = 0;
  server.use(
    http.get('*/v2/notebooks/:nid/search-index', () => {
      hits += 1;
      return HttpResponse.json(STATUS_READY);
    }),
  );
  renderHook(() => useSearchIndexRebuild(null));
  await new Promise((r) => setTimeout(r, 50));
  expect(hits).toBe(0);
});
