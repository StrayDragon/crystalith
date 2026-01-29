import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { expect, test, vi } from 'vitest';

import ChatPanel from './ChatPanel';
import type { ChatMessage, Citation, OutputTypeId } from '../../shared/types';

test('chat messages render assistant content', () => {
  const messages: ChatMessage[] = [
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Answer',
      citationScope: {
        mode: 'selected',
        kind: 'citations',
        count: 2,
        sources: ['Doc A', 'Doc B'],
      },
    },
  ];
  const citations: Citation[] = [];

  render(
    <ChatPanel
      messages={messages}
      draft=""
      onDraftChange={vi.fn()}
      onSend={vi.fn()}
      isSending={false}
      notice=""
      isBlocked={false}
      isConnected={true}
      inputRef={createRef<HTMLTextAreaElement>()}
      citations={citations}
      isLoadingMessages={false}
      messagesError=""
      onRetryMessages={vi.fn()}
      onSaveToNote={vi.fn()}
      onConvertToSource={vi.fn()}
      onConvertToOutput={vi.fn((_outputType: OutputTypeId) => Promise.resolve())}
      isConverting={false}
    />,
  );

  expect(screen.getByText('Answer')).toBeInTheDocument();
});
