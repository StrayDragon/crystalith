import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import { useWorkspaceStore } from '../shared/state/workspaceStore';
import type { OutputItem } from '../shared/types';
import WorkspaceTabs from './WorkspaceTabs';

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
});

// covers: r388
test('mobile tab bar exposes the three panel switching entries', () => {
  const onChange = rs.fn();

  render(<WorkspaceTabs activePanel="sources" onChange={onChange} />);

  const nav = screen.getByRole('navigation', { name: '工作区面板切换' });
  expect(nav).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '来源' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '聊天' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '笔记' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '聊天' }));
  expect(onChange).toHaveBeenCalledWith('chat');
});

// covers: r389
test('tab bar meets the accessibility baseline for the active entry', () => {
  render(<WorkspaceTabs activePanel="chat" onChange={rs.fn()} />);

  const chatTab = screen.getByRole('button', { name: '聊天' });
  expect(chatTab).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: '来源' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('button', { name: '笔记' })).not.toHaveAttribute('aria-current');

  // 当前项可聚焦、可识别
  chatTab.focus();
  expect(screen.getByRole('button', { name: '聊天' })).toHaveFocus();
});

// covers: r472
test('tab bar reserves bottom padding for the safe area', () => {
  render(<WorkspaceTabs activePanel="chat" onChange={rs.fn()} />);

  const nav = screen.getByRole('navigation', { name: '工作区面板切换' });
  const paddingBottom = (nav as HTMLElement).style.paddingBottom;
  expect(paddingBottom).toContain('env(safe-area-inset-bottom)');
  // 交互区域额外预留 0.5rem，点击目标不被系统 UI 遮挡
  expect(paddingBottom).toContain('0.5rem');
});

// covers: r471
test('switching tabs keeps critical in-progress state in the workspace store', () => {
  const output: OutputItem = {
    id: 7,
    type: 'FAQ',
    prompt: 'faq prompt',
    chunkIds: [1],
    content: {},
    contentLoaded: true,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
  };

  const store = useWorkspaceStore;
  store.getState().setDraft('未发送的草稿');
  store.getState().setSelectedSources({ 3: true, 4: true });
  store.getState().setOutputs([output]);
  store.getState().setActivePanel('chat');

  function Harness() {
    const activePanel = store((s) => s.activePanel);
    return (
      <WorkspaceTabs
        activePanel={activePanel}
        onChange={(panel) => store.getState().setActivePanel(panel)}
      />
    );
  }

  render(<Harness />);

  fireEvent.click(screen.getByRole('button', { name: '笔记' }));
  expect(store.getState().activePanel).toBe('refine');

  // 切换面板后：草稿、已选来源、输出列表均保留
  expect(store.getState().draft).toBe('未发送的草稿');
  expect(store.getState().selectedSourceIds).toEqual({ 3: true, 4: true });
  expect(store.getState().outputs).toEqual([output]);

  fireEvent.click(screen.getByRole('button', { name: '来源' }));
  expect(store.getState().activePanel).toBe('sources');
  expect(store.getState().draft).toBe('未发送的草稿');
  expect(store.getState().selectedSourceIds).toEqual({ 3: true, 4: true });
  expect(store.getState().outputs).toEqual([output]);
});
