import { useEffect, useMemo } from 'react';

export interface KeyboardShortcutBinding {
  id: string;
  combo: string;
  handler: (event: KeyboardEvent) => void;
  allowInInput?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  target?: Window | Document | HTMLElement | null;
}

const MODIFIER_TOKENS = new Set([
  'ctrl',
  'control',
  'meta',
  'command',
  'cmd',
  'shift',
  'alt',
  'option',
  'mod',
]);

function normalizeToken(raw: string): string {
  const token = raw.trim().toLowerCase();
  if (token === 'control') return 'ctrl';
  if (token === 'cmd' || token === 'command') return 'meta';
  if (token === 'option') return 'alt';
  if (token === 'esc') return 'escape';
  if (token === 'return') return 'enter';
  return token;
}

function normalizeEventKey(key: string): string {
  if (key === 'Esc') return 'escape';
  if (key === ' ') return 'space';
  return key.toLowerCase();
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  return target.isContentEditable || target.closest('[contenteditable="true"]') !== null;
}

function isEditableContext(eventTarget: EventTarget | null): boolean {
  const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
  return isEditableElement(eventTarget) || isEditableElement(activeElement);
}

function normalizeCombo(combo: string): string {
  const normalizedTokens = combo
    .split('+')
    .map((token) => normalizeToken(token))
    .filter(Boolean);

  const modifiers = normalizedTokens.filter((token) => MODIFIER_TOKENS.has(token)).toSorted();
  const key = normalizedTokens.find((token) => !MODIFIER_TOKENS.has(token)) ?? '';
  return [...modifiers, key].join('+');
}

export function matchShortcut(event: KeyboardEvent, combo: string): boolean {
  const tokens = combo
    .split('+')
    .map((token) => normalizeToken(token))
    .filter(Boolean);

  if (tokens.length === 0) return false;

  const requiresCtrl = tokens.includes('ctrl');
  const requiresMeta = tokens.includes('meta');
  const requiresShift = tokens.includes('shift');
  const requiresAlt = tokens.includes('alt');
  const requiresMod = tokens.includes('mod');

  const expectedKey = tokens.find((token) => !MODIFIER_TOKENS.has(token)) ?? null;

  if (requiresMod) {
    if (!event.ctrlKey && !event.metaKey) return false;
  } else {
    if (event.ctrlKey !== requiresCtrl) return false;
    if (event.metaKey !== requiresMeta) return false;
  }

  if (event.altKey !== requiresAlt) return false;

  const eventKey = normalizeEventKey(event.key);
  const isQuestionShortcut =
    expectedKey === '?' && (eventKey === '?' || (eventKey === '/' && event.shiftKey));

  if (requiresShift !== event.shiftKey && !isQuestionShortcut) {
    return false;
  }

  if (!expectedKey) return false;

  const normalizedExpectedKey = normalizeToken(expectedKey);
  if (isQuestionShortcut) return true;

  return eventKey === normalizedExpectedKey;
}

export function useKeyboardShortcuts(
  bindings: KeyboardShortcutBinding[],
  options: UseKeyboardShortcutsOptions = {},
) {
  const enabled = options.enabled ?? true;

  const activeBindings = useMemo(
    () => bindings.filter((binding) => binding.enabled !== false),
    [bindings],
  );

  const conflicts = useMemo(() => {
    const comboMap = new Map<string, string[]>();
    activeBindings.forEach((binding) => {
      const normalized = normalizeCombo(binding.combo);
      if (!comboMap.has(normalized)) {
        comboMap.set(normalized, [binding.id]);
      } else {
        comboMap.get(normalized)?.push(binding.id);
      }
    });

    return Array.from(comboMap.entries()).filter(([, ids]) => ids.length > 1);
  }, [activeBindings]);

  useEffect(() => {
    if (conflicts.length === 0) return;
    conflicts.forEach(([combo, ids]) => {
      console.warn(`[useKeyboardShortcuts] 检测到快捷键冲突: ${combo} -> ${ids.join(', ')}`);
    });
  }, [conflicts]);

  useEffect(() => {
    if (!enabled) return;

    const target = options.target ?? (typeof window !== 'undefined' ? window : null);
    if (!target || typeof target.addEventListener !== 'function') return;

    const handleKeyDown: EventListener = (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.defaultPrevented) return;

      for (const binding of activeBindings) {
        if (!matchShortcut(event, binding.combo)) continue;

        const targetIsInput = isEditableContext(event.target);
        if (targetIsInput && !binding.allowInInput) {
          return;
        }

        const shouldPreventDefault = binding.preventDefault ?? true;
        if (shouldPreventDefault) {
          event.preventDefault();
        }
        if (binding.stopPropagation) {
          event.stopPropagation();
        }

        binding.handler(event);
        return;
      }
    };

    target.addEventListener('keydown', handleKeyDown);

    return () => {
      target.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeBindings, enabled, options.target]);
}
