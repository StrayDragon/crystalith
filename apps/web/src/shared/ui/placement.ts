export type OverlaySide = 'top' | 'bottom' | 'left' | 'right';
export type OverlayAlign = 'start' | 'center' | 'end';

export function parsePlacement(placement?: string): { side: OverlaySide; align: OverlayAlign } {
  if (!placement) return { side: 'bottom', align: 'center' };
  const [rawSide, rawAlign] = placement.split('-');
  const side: OverlaySide =
    rawSide === 'top' || rawSide === 'left' || rawSide === 'right' ? rawSide : 'bottom';
  const align: OverlayAlign = rawAlign === 'start' || rawAlign === 'end' ? rawAlign : 'center';
  return { side, align };
}
