import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as proposeNodeChatTurnActual from './model/proposeNodeChatTurn' with {
  rstest: 'importActual',
};

const streamNodeChat = rs.hoisted(() => rs.fn());
const proposeNodeChatTurn = rs.hoisted(() => rs.fn());

// Mock reason: assert Eden drawer uses HTTP chat SSE, not fixture propose.
rs.mock('./edenResearchApi', () => ({
  streamNodeChat: (...args: unknown[]) => streamNodeChat(...args),
}));

// Mock reason: detect accidental fixture propose on Eden path (r438/r440).
rs.mock('./model/proposeNodeChatTurn', () => {
  return {
    ...proposeNodeChatTurnActual,
    proposeNodeChatTurn: (...args: unknown[]) => proposeNodeChatTurn(...args),
  };
});

import LabNodeDrawer from './LabNodeDrawer';
import type { LabNode } from './model/types';

const researchNode: LabNode = {
  id: 'branch_a',
  title: '支路A',
  role: 'research',
  conclusionStatus: 'pending',
  phase: 'idle',
  citationIds: [],
  query: 'q',
};

describe('LabNodeDrawer chat mode (c88)', () => {
  beforeEach(() => {
    streamNodeChat.mockReset();
    proposeNodeChatTurn.mockReset();
    proposeNodeChatTurn.mockReturnValue({
      assistantText: 'fixture reply',
      proposals: [],
    });
  });

  it('eden send calls streamNodeChat and NOT proposeNodeChatTurn', async () => {
    streamNodeChat.mockImplementation(async function* () {
      yield { event: 'chunk', data: { text: 'Eden 回复' } };
      yield { event: 'done', data: {} };
    });

    render(
      <LabNodeDrawer
        node={researchNode}
        citations={{}}
        phase="explore"
        mode="eden"
        notebookId={62}
        runId={9}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByText('对话'));
    const input = screen.getByTestId('research-lab-chat-input');
    fireEvent.change(input, { target: { value: '请总结' } });
    fireEvent.click(screen.getByTestId('research-lab-chat-send'));

    await waitFor(() => {
      expect(streamNodeChat).toHaveBeenCalledWith(
        62,
        9,
        'branch_a',
        { message: '请总结' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(proposeNodeChatTurn).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Eden 回复')).toBeTruthy();
    });
  });

  it('fixture send may call proposeNodeChatTurn', async () => {
    const { unmount } = render(
      <LabNodeDrawer
        node={{ ...researchNode, id: 'fixture-branch' }}
        citations={{}}
        phase="explore"
        mode="fixture"
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByText('对话'));
    fireEvent.change(screen.getByTestId('research-lab-chat-input'), {
      target: { value: '剪枝' },
    });
    fireEvent.click(screen.getByTestId('research-lab-chat-send'));

    await waitFor(() => {
      expect(proposeNodeChatTurn).toHaveBeenCalled();
    });
    expect(streamNodeChat).not.toHaveBeenCalled();
    // Wait for fixture streamInto to finish before teardown (avoids window-after-unmount).
    await waitFor(() => {
      expect(screen.getByText('fixture reply')).toBeTruthy();
    });
    unmount();
  });

  it('llmBusy disables send', () => {
    render(
      <LabNodeDrawer
        node={{ ...researchNode, id: 'busy-branch' }}
        citations={{}}
        phase="explore"
        mode="eden"
        notebookId={62}
        runId={9}
        llmBusy
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByText('对话'));
    const send = screen.getByTestId('research-lab-chat-send');
    expect(send).toBeDisabled();
    expect(screen.getByText(/研究或节点对话进行中/)).toBeTruthy();
  });

  it('chat error event is visible', async () => {
    streamNodeChat.mockImplementation(async function* () {
      yield {
        event: 'error',
        data: { errorCode: 'X', message: '对话被拒绝' },
      };
    });
    const onChatError = rs.fn();

    render(
      <LabNodeDrawer
        node={{ ...researchNode, id: 'err-branch' }}
        citations={{}}
        phase="explore"
        mode="eden"
        notebookId={62}
        runId={9}
        onChatError={onChatError}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByText('对话'));
    fireEvent.change(screen.getByTestId('research-lab-chat-input'), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByTestId('research-lab-chat-send'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('对话被拒绝');
    });
    expect(onChatError).toHaveBeenCalledWith('对话被拒绝');
  });
});
