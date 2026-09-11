import { afterEach, beforeEach, expect, test, rs } from '@rstest/core';

import { renderHook } from '../../../../test-utils/renderHook';
import { matchShortcut, useKeyboardShortcuts } from './useKeyboardShortcuts';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  rs.restoreAllMocks();
});

test('dispatches global shortcut when focus is outside inputs', () => {
  const onSearch = rs.fn();

  renderHook(() =>
    useKeyboardShortcuts([
      {
        id: 'open-search',
        combo: 'Ctrl+K',
        handler: onSearch,
      },
    ]),
  );

  const event = new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });

  window.dispatchEvent(event);

  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
});

test('ignores global shortcut when input has focus', () => {
  const onSearch = rs.fn();

  renderHook(() =>
    useKeyboardShortcuts([
      {
        id: 'open-search',
        combo: 'Ctrl+K',
        handler: onSearch,
      },
    ]),
  );

  const textarea = document.createElement('textarea');
  document.body.append(textarea);
  textarea.focus();

  const event = new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });

  textarea.dispatchEvent(event);

  expect(onSearch).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
});

test('ignores global shortcut when activeElement is input even if event targets window', () => {
  const onSearch = rs.fn();

  renderHook(() =>
    useKeyboardShortcuts([
      {
        id: 'open-search',
        combo: 'Ctrl+K',
        handler: onSearch,
      },
    ]),
  );

  const textarea = document.createElement('textarea');
  document.body.append(textarea);
  textarea.focus();

  const event = new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });

  window.dispatchEvent(event);

  expect(onSearch).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
});

test('supports allowInInput for Ctrl+K command palette from textarea', () => {
  const onPalette = rs.fn();

  renderHook(() =>
    useKeyboardShortcuts([
      {
        id: 'open-command-palette',
        combo: 'Ctrl+K',
        allowInInput: true,
        handler: onPalette,
      },
    ]),
  );

  const textarea = document.createElement('textarea');
  document.body.append(textarea);
  textarea.focus();

  const event = new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });

  textarea.dispatchEvent(event);

  expect(onPalette).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
});

test('supports allowInInput shortcuts like Ctrl+Enter', () => {
  const onSend = rs.fn();

  renderHook(() =>
    useKeyboardShortcuts([
      {
        id: 'send-message',
        combo: 'Ctrl+Enter',
        allowInInput: true,
        handler: onSend,
      },
    ]),
  );

  const textarea = document.createElement('textarea');
  document.body.append(textarea);
  textarea.focus();

  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });

  textarea.dispatchEvent(event);

  expect(onSend).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
});

test('detects duplicate shortcut conflicts', () => {
  // Mock reason: silence expected warning output while asserting duplicate detection behavior.
  const warnSpy = rs.spyOn(console, 'warn').mockImplementation(() => {});

  renderHook(() =>
    useKeyboardShortcuts([
      { id: 'first', combo: 'Ctrl+K', handler: rs.fn() },
      { id: 'second', combo: 'Ctrl+K', handler: rs.fn() },
    ]),
  );

  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(String(warnSpy.mock.calls[0]?.[0])).toContain('ctrl+k');
});

test('matches Ctrl+? via Shift+/', () => {
  const event = new KeyboardEvent('keydown', {
    key: '/',
    ctrlKey: true,
    shiftKey: true,
  });

  expect(matchShortcut(event, 'Ctrl+?')).toBe(true);
});
