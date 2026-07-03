import type { GridStackWidget } from "gridstack";

import type { WidgetDef, WidgetMeta } from "./types";
import { GRID_ROWS } from "./widgetRegistry";

export const LAYOUT_STORAGE_KEY = "crystalith_workspace_grid_layout_v1";

export function readSavedLayout(widgetMeta: Record<string, WidgetMeta>): WidgetDef[] | null {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as GridStackWidget[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const layout: WidgetDef[] = [];
    for (const item of parsed) {
      if (typeof item.id !== "string" || !widgetMeta[item.id]) return null;
      const meta = widgetMeta[item.id];
      layout.push({
        id: item.id,
        x: item.x ?? 0,
        y: item.y ?? 0,
        w: item.w ?? meta.defaultW,
        h: item.h ?? GRID_ROWS,
        minW: meta.minW,
        minH: meta.minH,
      });
    }

    return layout;
  } catch {
    return null;
  }
}

export function writeSavedLayout(saved: GridStackWidget[]): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // ignore quota / private mode
  }
}
