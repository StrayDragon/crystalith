import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { useRefine } from './useRefine';

// Mock reason: isolate workspace tools normalization from output queue scheduler.
vi.mock('../../shared/hooks/useOutputQueue', () => ({
  useOutputQueue: () => ({
    outputQueueJobs: [],
    enqueueOutputJob: vi.fn(),
    enqueueSlidesJob: vi.fn(),
    hasPendingJobs: () => false,
    outputsLoading: false,
    outputsError: '',
    retryOutputs: vi.fn(),
    retryOutputJob: vi.fn(),
    cancelOutputJob: vi.fn(),
    deleteOutput: vi.fn(),
    clearOutputs: vi.fn(),
    fetchOutput: vi.fn(),
    ensureOutputDetail: vi.fn(),
  }),
}));

function wrapSWR({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  useWorkspaceStore.setState({
    notebooks: [],
    activeNotebookId: null,
    sessions: [],
    activeSessionId: null,
    sources: [],
    selectedSourceIds: {},
    messages: [],
    draft: '',
    citations: [],
    hoveredCitationChunkId: null,
    hoveredMessageChunkIds: [],
    jumpToCitationChunkId: null,
    outputs: [],
    outputType: 'FAQ',
    refineMode: 'paragraph',
    refinePrompt: '',
    refineJobs: [],
    refineSettings: { autoTrigger: false, asyncQueue: true },
    hasNewOutput: false,
    recentCompletedJobId: null,
    activePanel: 'chat',
    createState: 'idle',
    createName: '',
    connectionState: 'connecting',
    uploadState: 'idle',
    loading: {
      notebooks: false,
      sources: false,
      sessions: false,
      messages: false,
      outputs: false,
      send: false,
    },
    errors: {
      notebooks: '',
      sources: '',
      sessions: '',
      messages: '',
      outputs: '',
      send: '',
      create: '',
    },
  });

  server.use(http.get('*/v2/workspace/tools', () => HttpResponse.json({ tools: [] })));
});

test('normalizes slides tool config schema from workspace tools', async () => {
  server.use(
    http.get('*/v2/workspace/tools', () =>
      HttpResponse.json({
        tools: [
          {
            id: 'slides-slidev',
            label: '演示',
            description: '演示文稿',
            tone: 'indigo',
            outputType: 'SLIDES',
            prompt: '生成 slides',
            enabled: true,
            configSchema: {
              engine: 'slidev',
              preview: {
                kind: 'external_url',
                service: 'slidev',
              },
              themePresetOptions: [
                {
                  id: 'default',
                  label: 'Default',
                },
              ],
            },
          },
        ],
        diagnostics: {
          plugins: {
            loaded: ['slides-slidev'],
            skipped: {},
          },
          slides: {
            activePluginId: 'slides-slidev',
            engine: 'slidev',
          },
        },
      }),
    ),
  );

  const { result } = renderHook(() => useRefine(), { wrapper: wrapSWR });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
  });

  await waitFor(() => {
    expect(result.current.tools).toHaveLength(1);
  });

  expect(result.current.tools[0].configSchema?.themePresetOptions).toEqual([
    {
      id: 'default',
      label: 'Default',
      template: {},
    },
  ]);
  expect(result.current.tools[0].configSchema?.preview?.service).toBe('slidev');
});
