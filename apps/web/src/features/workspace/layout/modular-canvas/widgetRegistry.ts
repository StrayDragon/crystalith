import type { WidgetDef, WidgetMeta } from './types';

export const GRID_ROWS = 6;

/** Known modular-canvas widget ids (layout + catalog). */
export type CanvasWidgetId = 'sources' | 'chat' | 'studio';

/** Keep Record<string, …> so ModularCanvas can index with runtime string ids. */
export const WIDGET_REGISTRY: Record<string, WidgetMeta> = {
  sources: {
    id: 'sources',
    label: '来源',
    icon: '',
    defaultW: 3,
    defaultH: GRID_ROWS,
    minW: 2,
    minH: 2,
  },
  chat: { id: 'chat', label: '对话', icon: '', defaultW: 6, defaultH: GRID_ROWS, minW: 3, minH: 2 },
  studio: {
    id: 'studio',
    label: '笔记',
    icon: '',
    defaultW: 3,
    defaultH: GRID_ROWS,
    minW: 2,
    minH: 2,
  },
} satisfies Record<CanvasWidgetId, WidgetMeta>;

export const DEFAULT_LAYOUT: WidgetDef[] = [
  { id: 'sources', x: 0, y: 0, w: 3, h: GRID_ROWS, minW: 2, minH: 2 },
  { id: 'studio', x: 3, y: 0, w: 3, h: GRID_ROWS, minW: 2, minH: 2 },
  { id: 'chat', x: 6, y: 0, w: 6, h: GRID_ROWS, minW: 3, minH: 2 },
];
