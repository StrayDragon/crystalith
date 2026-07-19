import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1,
  );
}

interface UseFocusTrapOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement>;
  onEscape?: () => void;
}

export function useFocusTrap({ active, containerRef, onEscape }: UseFocusTrapOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousFocusRef.current = previouslyFocused;

    // Blur trigger before any overlay marks ancestors aria-hidden (Chrome a11y warning).
    if (previouslyFocused && !container.contains(previouslyFocused)) {
      previouslyFocused.blur();
    }

    if (!container.hasAttribute('tabindex')) {
      container.tabIndex = -1;
    }

    const focusInitial = () => {
      if (!active || !container.isConnected) return;
      const focusables = getFocusableElements(container);
      const initialFocus = focusables[0] ?? container;
      initialFocus.focus({ preventScroll: true });
    };

    // Double rAF: wait until portal/dialog content is in the tree.
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(focusInitial);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const nodes = getFocusableElements(container);
      if (nodes.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes.at(-1);
      const target = event.target as Node | null;

      if (event.shiftKey) {
        if (target === first || !target || !container.contains(target)) {
          event.preventDefault();
          last?.focus();
        }
        return;
      }

      if (target === last || !target || !container.contains(target)) {
        event.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      container.removeEventListener('keydown', handleKeyDown);
      const restore = previousFocusRef.current;
      previousFocusRef.current = null;
      if (restore?.isConnected) {
        restore.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, onEscape]);
}
