/** Parse JSON without propagating `any` from `JSON.parse`. */
export function parseJsonValue(raw: string): unknown {
  return JSON.parse(raw);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `Event.target` narrowed to `Node` when possible. */
export function eventTargetNode(event: Event): Node | null {
  const target = event.target;
  return target instanceof Node ? target : null;
}

/** Narrow `EventTarget` to `HTMLElement` when possible. */
export function targetElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}
