import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import { renderHook } from '../../../test-utils/renderHook';
import { useResearch } from './useResearch';
import {
  createResearchSessionV1NotebooksNotebookIdResearchPost,
  deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete,
  listResearchSessionsV1NotebooksNotebookIdResearchGet,
} from '../../../api/client';

vi.mock('../../../api/client', () => ({
  createResearchSessionV1NotebooksNotebookIdResearchPost: vi.fn(),
  deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete: vi.fn(),
  listResearchSessionsV1NotebooksNotebookIdResearchGet: vi.fn(),
  getResearchSessionV1NotebooksNotebookIdResearchResearchIdGet: vi.fn(),
  startResearchV1NotebooksNotebookIdResearchResearchIdStartPost: vi.fn(),
  approveSearchPlanV1NotebooksNotebookIdResearchResearchIdApprovePost: vi.fn(),
  finishResearchV1NotebooksNotebookIdResearchResearchIdFinishPost: vi.fn(),
  skipIterationV1NotebooksNotebookIdResearchResearchIdSkipPost: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('fetchSessions stores list data', async () => {
  vi.mocked(listResearchSessionsV1NotebooksNotebookIdResearchGet).mockResolvedValue({
    data: [
      {
        id: 1,
        notebook_id: 1,
        topic: 'Topic',
        status: 'planning',
        current_iteration: 0,
        max_iterations: 3,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ],
  } as any);

  const { result } = renderHook(() => useResearch(1));

  await act(async () => {
    await result.current.fetchSessions();
  });

  await waitFor(() => {
    expect(result.current.sessions).toHaveLength(1);
  });
  expect(result.current.sessions[0].topic).toBe('Topic');
});

test('createSession updates sessions and activeSession', async () => {
  vi.mocked(createResearchSessionV1NotebooksNotebookIdResearchPost).mockResolvedValue({
    data: {
      id: 2,
      notebook_id: 1,
      topic: 'New Topic',
      status: 'planning',
      current_iteration: 0,
      max_iterations: 4,
      created_at: '2024-01-02',
      updated_at: '2024-01-02',
    },
  } as any);

  const { result } = renderHook(() => useResearch(1));

  let created: any = null;
  await act(async () => {
    created = await result.current.createSession('New Topic', 4);
  });

  expect(created?.id).toBe(2);
  await waitFor(() => {
    expect(result.current.sessions[0].id).toBe(2);
  });
  expect(result.current.activeSession?.id).toBe(2);
});

test('deleteSession removes session and clears active session', async () => {
  vi.mocked(createResearchSessionV1NotebooksNotebookIdResearchPost).mockResolvedValue({
    data: {
      id: 22,
      notebook_id: 1,
      topic: 'Topic',
      status: 'planning',
      current_iteration: 0,
      max_iterations: 4,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  } as any);

  vi.mocked(deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete).mockResolvedValue(
    {} as any,
  );

  const { result } = renderHook(() => useResearch(1));

  await act(async () => {
    await result.current.createSession('Topic');
  });

  await act(async () => {
    await result.current.deleteSession(22);
  });

  expect(result.current.sessions).toHaveLength(0);
  expect(result.current.activeSession).toBeNull();
});
