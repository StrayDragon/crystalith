import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { SWRConfig } from 'swr';

import { server } from '../../../../test-utils/msw/server';
import { TestProviders } from '../../../../test-utils/providers';
import type { ChatMessage, Citation, OutputTypeId } from '../../shared/types';
import ChatPanel from './ChatPanel';

beforeEach(() => {
  server.use(http.get('*/v2/commands', () => HttpResponse.json([])));
});

type ChatPanelOverrides = Partial<ComponentProps<typeof ChatPanel>>;

function buildChatPanelElement(overrides?: ChatPanelOverrides) {
  const defaultMessages: ChatMessage[] = [];
  const defaultCitations: Citation[] = [];

  return (
    <div style={{ height: 640, width: 720 }}>
      <TestProviders>
        <SWRConfig value={{ provider: () => new Map() }}>
          <ChatPanel
            messages={defaultMessages}
            draft=""
            onDraftChange={rs.fn()}
            onSend={rs.fn()}
            isSending={false}
            notice=""
            isBlocked={false}
            isConnected={true}
            inputRef={createRef<HTMLTextAreaElement>()}
            citations={defaultCitations}
            isLoadingMessages={false}
            messagesError=""
            onRetryMessages={rs.fn()}
            onSaveToNote={rs.fn()}
            onConvertToSource={rs.fn()}
            onConvertToOutput={rs.fn((_outputType: OutputTypeId) => Promise.resolve())}
            isConverting={false}
            {...overrides}
          />
        </SWRConfig>
      </TestProviders>
    </div>
  );
}

function renderChatPanel(overrides?: ChatPanelOverrides) {
  return render(buildChatPanelElement(overrides));
}

test('chat messages render assistant content as markdown', async () => {
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

  const { container } = renderChatPanel({ messages });

  await screen.findByText('markdown');
  expect(container.querySelector('[data-streamdown="strong"]')?.textContent).toBe('markdown');
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
  const onRetrySend = rs.fn();

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
  const onStopStreaming = rs.fn();

  renderChatPanel({
    isStreaming: true,
    onStopStreaming,
  });

  const stopButton = screen.getByRole('button', { name: '停止生成' });
  expect(stopButton).toBeInTheDocument();

  fireEvent.click(stopButton);
  expect(onStopStreaming).toHaveBeenCalledTimes(1);
});

// covers: r400
test('chat input accepts /prompt directive text and sends it', () => {
  const onSend = rs.fn();

  renderChatPanel({ draft: '/prompt:analysis 总结这篇论文', onSend });

  const sendButton = screen.getByRole('button', { name: '发送' });
  expect(sendButton).not.toBeDisabled();

  fireEvent.click(sendButton);
  expect(onSend).toHaveBeenCalledTimes(1);
});

// covers: r401
test('chat input autocompletes /prompt presets from /v2/commands', async () => {
  const onDraftChange = rs.fn();

  server.use(
    http.get('*/v2/commands', () =>
      HttpResponse.json([
        {
          id: 'cmd-analysis',
          trigger: '/prompt:analysis',
          description: '深度分析模式',
          enabled: true,
          source: 'builtin',
        },
        {
          id: 'cmd-stats',
          trigger: '/prompt:stats',
          description: '统计模式',
          enabled: true,
          source: 'custom',
        },
      ]),
    ),
  );

  renderChatPanel({ draft: '', onDraftChange });

  const input = screen.getByLabelText('对话输入');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '/prompt:' } });

  const listbox = await screen.findByRole('listbox', { name: '指令补全' });
  expect(listbox).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /\/prompt:analysis/ })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /\/prompt:stats/ })).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByRole('option', { name: /\/prompt:analysis/ }));
  expect(onDraftChange).toHaveBeenCalledWith('/prompt:analysis ');
});

// covers: r403
test('chat panel renders assistant markdown and user message as plain text', async () => {
  // Virtuoso 在 jsdom 只稳定渲染消息窗口末端，故分两个单消息场景断言
  const { container, unmount } = renderChatPanel({
    messages: [{ id: 'assistant-1', role: 'assistant', content: '结论 **加粗** 结束' }],
  });

  await screen.findByText('加粗');
  // assistant 侧渲染 markdown
  expect(container.querySelector('[data-streamdown="strong"]')?.textContent).toBe('加粗');
  unmount();

  renderChatPanel({
    messages: [{ id: 'user-1', role: 'user', content: '第一行\n第二行 **加粗** 字面量' }],
  });

  const plainNode = await screen.findByText(/第二行/);
  // user 侧保持纯文本（whitespace-pre-wrap），markdown 语法字面保留
  expect(plainNode.className).toContain('whitespace-pre-wrap');
  expect(plainNode.textContent).toBe('第一行\n第二行 **加粗** 字面量');
  expect(plainNode.querySelector('[data-streamdown]')).toBeNull();
});

// covers: r406
test('chat send stays enabled when no sources are selected', () => {
  const onSend = rs.fn();

  renderChatPanel({ draft: '未勾选来源也能提问', hasSources: true, onSend });

  const sendButton = screen.getByRole('button', { name: '发送' });
  expect(sendButton).not.toBeDisabled();
  expect(screen.queryByText('1 个来源')).not.toBeInTheDocument();

  fireEvent.click(sendButton);
  expect(onSend).toHaveBeenCalledTimes(1);
});

// covers: r414
test('chat panel keeps user markdown literal and hides mid-stream raw fences', async () => {
  // Virtuoso 在 jsdom 只稳定渲染消息窗口末端，user 纯文本断言单独渲染
  renderChatPanel({
    messages: [{ id: 'user-1', role: 'user', content: '# 这不是标题' }],
  });

  const userNode = await screen.findByText('# 这不是标题');
  expect(userNode.className).toContain('whitespace-pre-wrap');
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});

// covers: r414
test('assistant mid-stream unclosed fence does not leak raw fence characters', async () => {
  renderChatPanel({
    messages: [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '回答开头\n\n```ts\nconst x = 1;',
      },
    ],
    isStreaming: true,
    streamingMessageId: 'assistant-1',
  });

  await screen.findByText('回答开头');

  // 流式中间态：未闭合围栏不闪现原始字符
  expect(screen.queryByText('```ts')).not.toBeInTheDocument();
});

test('chat panel still shows local messages while history is loading', async () => {
  renderChatPanel({
    isLoadingMessages: true,
    messages: [{ id: 'user-1', role: 'user', content: '刚发出去的问题' }],
  });

  expect(await screen.findByText('刚发出去的问题')).toBeTruthy();
});
