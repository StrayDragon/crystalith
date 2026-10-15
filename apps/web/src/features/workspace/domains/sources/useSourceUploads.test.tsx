// Dedup handshake glue — 409 CONFLICT (details = SourceDedupHitDetails) must
// reach the confirm dialog and drive the second upload with the chosen
// dedupAction. Locks the seam end-to-end through the eden client + MSW:
// the server sends the generic CONFLICT code (c54) and the details payload
// discriminates dedup hits (c134 r490 / c135 r491).
import { expect, test, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import type { SourceSeamContext } from './sourceSeamContext';
import { useSourceUploads } from './useSourceUploads';

function dedup409(details: Record<string, unknown>) {
  return HttpResponse.json(
    { errorCode: 'CONFLICT', message: 'Source dedup hit', details },
    { status: 409 },
  );
}

function useUploadsHook() {
  const ctx: SourceSeamContext = { activeNotebookId: 3, isConnected: true, mutate: rs.fn() };
  return renderHook(() => useSourceUploads(ctx));
}

test('filename 409 opens the dialog with real details; replace re-uploads with dedupAction=replace', async () => {
  const dedupActions: (string | null)[] = [];
  server.use(
    http.post('*/v2/notebooks/:nid/sources/upload', ({ request }) => {
      dedupActions.push(new URL(request.url).searchParams.get('dedupAction'));
      if (dedupActions.length === 1) {
        return dedup409({
          kind: 'filename',
          existingSourceId: 5,
          existingFilename: '旧文档.md',
        });
      }
      return HttpResponse.json({
        sourceId: 9,
        chunkCount: 2,
        parserType: 'text',
        status: 'ready',
      });
    }),
  );

  const { result } = renderHook(() => {
    const ctx: SourceSeamContext = { activeNotebookId: 3, isConnected: true, mutate: rs.fn() };
    return useSourceUploads(ctx);
  });

  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current.handleUpload(new File(['new bytes'], '旧文档.md'));
  });

  await waitFor(() => expect(result.current.dedupConfirm).not.toBeNull());
  expect(result.current.dedupConfirm?.existingName).toBe('旧文档.md');
  expect(result.current.dedupConfirm?.kind).toBe('filename');

  act(() => {
    result.current.resolveDedupConfirm('replace');
  });
  await act(async () => {
    await pending;
  });

  expect(dedupActions).toEqual(['prompt', 'replace']);
  expect(result.current.dedupConfirm).toBeNull();
  const replaced = result.current.uploadQueue.find((item) => item.message === '已替换旧来源');
  expect(replaced?.status).toBe('success');
});

test('content 409 resolves through reuse; the reuse upload carries dedupAction=reuse', async () => {
  const dedupActions: (string | null)[] = [];
  server.use(
    http.post('*/v2/notebooks/:nid/sources/upload', ({ request }) => {
      dedupActions.push(new URL(request.url).searchParams.get('dedupAction'));
      if (dedupActions.length === 1) {
        return dedup409({ kind: 'content', existingSourceId: 7, existingFilename: 'a.txt' });
      }
      return HttpResponse.json({ reused: true, sourceId: 7 });
    }),
  );

  const { result } = useUploadsHook();

  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current.handleUpload(new File(['same bytes'], 'b.txt'));
  });

  await waitFor(() => expect(result.current.dedupConfirm?.kind).toBe('content'));
  expect(result.current.dedupConfirm?.existingName).toBe('a.txt');

  act(() => {
    result.current.resolveDedupConfirm('reuse');
  });
  await act(async () => {
    await pending;
  });

  expect(dedupActions).toEqual(['prompt', 'reuse']);
  expect(result.current.uploadQueue.find((item) => item.message === '已复用已有来源')?.status).toBe(
    'success',
  );
});

test('CONFLICT without dedup details is a plain failure — no dialog', async () => {
  server.use(
    http.post('*/v2/notebooks/:nid/sources/upload', () =>
      HttpResponse.json(
        { errorCode: 'CONFLICT', message: 'Tag name already exists' },
        { status: 409 },
      ),
    ),
  );

  const { result } = useUploadsHook();

  await act(async () => {
    await result.current.handleUpload(new File(['x'], 'x.txt'));
  });

  expect(result.current.dedupConfirm).toBeNull();
  expect(result.current.uploadQueue.every((item) => item.status === 'error')).toBe(true);
  expect(result.current.uploadError).not.toBe('');
});

test('from-url 409 opens the dialog; reuse re-posts with dedupAction=reuse', async () => {
  const dedupActions: (string | null)[] = [];
  server.use(
    http.post('*/v2/notebooks/:nid/sources/from-url', ({ request }) => {
      dedupActions.push(new URL(request.url).searchParams.get('dedupAction'));
      if (dedupActions.length === 1) {
        return dedup409({
          kind: 'content',
          existingSourceId: 4,
          existingFilename: '网页快照',
        });
      }
      return HttpResponse.json({ reused: true, sourceId: 4 });
    }),
  );

  const { result } = useUploadsHook();

  let pending: Promise<unknown> | undefined;
  act(() => {
    pending = result.current.addSourceFromUrl('https://example.com/doc', 'link');
  });

  await waitFor(() => expect(result.current.dedupConfirm?.existingName).toBe('网页快照'));

  act(() => {
    result.current.resolveDedupConfirm('reuse');
  });
  await act(async () => {
    await pending;
  });

  expect(dedupActions).toEqual([null, 'reuse']);
});
