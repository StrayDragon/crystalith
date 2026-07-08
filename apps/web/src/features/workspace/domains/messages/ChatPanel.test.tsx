import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';

import { LayerProvider } from '../../../../shared/layer';
import { server } from '../../../../test-utils/msw/server';
import type { ChatMessage, Citation, OutputTypeId } from '../../shared/types';
import ChatPanel from './ChatPanel';

beforeEach(() => {
  server.use(http.get('*/v1/commands', () => HttpResponse.json([])));
});

type ChatPanelOverrides = Partial<ComponentProps<typeof ChatPanel>>;

function buildChatPanelElement(overrides?: ChatPanelOverrides) {
  const defaultMessages: ChatMessage[] = [];
  const defaultCitations: Citation[] = [];

  return (
    <div style={{ height: 640, width: 720 }}>
      <LayerProvider>
        <SWRConfig value={{ provider: () => new Map() }}>
          <ChatPanel
            messages={defaultMessages}
            draft=""
            onDraftChange={vi.fn()}
            onSend={vi.fn()}
            isSending={false}
            notice=""
            isBlocked={false}
            isConnected={true}
            inputRef={createRef<HTMLTextAreaElement>()}
            citations={defaultCitations}
            isLoadingMessages={false}
            messagesError=""
            onRetryMessages={vi.fn()}
            onSaveToNote={vi.fn()}
            onConvertToSource={vi.fn()}
            onConvertToOutput={vi.fn((_outputType: OutputTypeId) => Promise.resolve())}
            isConverting={false}
            {...overrides}
          />
        </SWRConfig>
      </LayerProvider>
    </div>
  );
}

function renderChatPanel(overrides?: ChatPanelOverrides) {
  return render(buildChatPanelElement(overrides));
}

test('chat messages render assistant content as plain text', async () => {
  const messages: ChatMessage[] = [
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Answer **markdown**',
      citationScope: {
        mode: 'selected',
        kind: 'citations',
        count: 2,
        sources: ['Doc A', 'Doc B'],
      },
    },
  ];

  renderChatPanel({ messages });

  expect(await screen.findByText('Answer **markdown**')).toBeInTheDocument();
});

test('chat panel virtualizes large message list', async () => {
  const messages: ChatMessage[] = Array.from({ length: 500 }, (_, index) => ({
    id: `msg-${index + 1}`,
    role: index % 2 === 0 ? 'assistant' : 'user',
    content: `Message ${index + 1}`,
    citationScope: {
      mode: 'selected',
      kind: 'citations',
      count: 0,
      sources: [],
    },
  }));

  renderChatPanel({ messages });

  await waitFor(() => {
    expect(screen.getAllByTestId('chat-message-item').length).toBeGreaterThan(0);
  });

  const mountedItems = screen.getAllByTestId('chat-message-item').length;
  expect(mountedItems).toBeLessThan(messages.length);
});

test('chat panel shows retry send button when notice exists', () => {
  const onRetrySend = vi.fn();

  renderChatPanel({
    notice: '发送失败，请稍后重试',
    onRetrySend,
  });

  const retryButton = screen.getByRole('button', { name: '重试发送' });
  expect(retryButton).toBeInTheDocument();

  fireEvent.click(retryButton);
  expect(onRetrySend).toHaveBeenCalledTimes(1);
});

test('chat panel shows stop streaming button', () => {
  const onStopStreaming = vi.fn();

  renderChatPanel({
    isStreaming: true,
    onStopStreaming,
  });

  const stopButton = screen.getByRole('button', { name: '停止生成' });
  expect(stopButton).toBeInTheDocument();

  fireEvent.click(stopButton);
  expect(onStopStreaming).toHaveBeenCalledTimes(1);
});
