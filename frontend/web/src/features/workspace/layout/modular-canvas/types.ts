import type { ReactNode } from "react";

export interface WidgetDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface WidgetMeta {
  id: string;
  label: string;
  icon: ReactNode;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
}
