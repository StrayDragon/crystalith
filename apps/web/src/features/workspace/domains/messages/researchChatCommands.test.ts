import { describe, expect, it, vi } from 'vitest';

import {
  executeResearchChatCommand,
  isResearchChatCommandLine,
  parseResearchChatCommand,
} from './researchChatCommands';

describe('researchChatCommands (c99)', () => {
  it('parses bare /research and /深研 as open_compose', () => {
    expect(parseResearchChatCommand('/research')).toEqual({
      type: 'open_compose',
      topic: null,
    });
    expect(parseResearchChatCommand('/深研')).toEqual({ type: 'open_compose', topic: null });
  });

  it('parses topic after /research', () => {
    expect(parseResearchChatCommand('/research  xlsx 解析 ')).toEqual({
      type: 'open_compose',
      topic: 'xlsx 解析',
    });
    expect(parseResearchChatCommand('/深研 主题A')).toEqual({
      type: 'open_compose',
      topic: '主题A',
    });
  });

  it('parses /research-open <rid>', () => {
    expect(parseResearchChatCommand('/research-open 42')).toEqual({
      type: 'open_run',
      runId: 42,
    });
  });

  it('rejects bare /research-open and non-commands', () => {
    expect(parseResearchChatCommand('/research-open')).toBeNull();
    expect(parseResearchChatCommand('/prompt:eli5')).toBeNull();
    expect(parseResearchChatCommand('hello')).toBeNull();
    expect(isResearchChatCommandLine('/research-open')).toBe(true);
    expect(isResearchChatCommandLine('/prompt:eli5')).toBe(false);
  });

  it('execute navigates compose and run', () => {
    const navigate = vi.fn();
    expect(executeResearchChatCommand({ type: 'open_compose', topic: null }, 7, navigate)).toEqual({
      ok: true,
      message: '已打开深研 Compose',
    });
    expect(navigate).toHaveBeenCalledWith(7, null, undefined);

    navigate.mockClear();
    executeResearchChatCommand({ type: 'open_compose', topic: 't' }, 7, navigate);
    expect(navigate).toHaveBeenCalledWith(7, null, { topic: 't' });

    navigate.mockClear();
    executeResearchChatCommand({ type: 'open_run', runId: 9 }, 7, navigate);
    expect(navigate).toHaveBeenCalledWith(7, 9);
  });
});
