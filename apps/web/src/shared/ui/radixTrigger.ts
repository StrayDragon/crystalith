import { useRef, type MouseEvent, type PointerEvent } from 'react';

/**
 * Radix dropdown/popover triggers toggle on pointerdown (button === 0).
 * jsdom + Testing Library `fireEvent.click` often never fires a qualifying
 * pointerdown, so menus stay closed. Replay a primary pointerdown from click
 * when that sequence was skipped. Real pointer clicks set the flag first and
 * skip the replay (avoids open-then-close).
 */
export function useRadixTriggerClickFallback() {
  const openedByPointerRef = useRef(false);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button === 0 && event.ctrlKey === false) {
        openedByPointerRef.current = true;
      }
    },
    onClick(event: MouseEvent<HTMLElement>) {
      if (openedByPointerRef.current) {
        openedByPointerRef.current = false;
        return;
      }
      event.currentTarget.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          cancelable: true,
          isPrimary: true,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      );
    },
  };
}
