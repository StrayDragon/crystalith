import { GridStack, type GridHTMLElement } from 'gridstack';
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import 'gridstack/dist/gridstack.min.css';

import { readSavedLayout, writeSavedLayout } from './layoutStorage';
import { GRIDSTACK_STYLES } from './modularCanvasStyles';
import type { WidgetDef, WidgetMeta } from './types';
import { GRID_ROWS } from './widgetRegistry';
import WidgetShell from './WidgetShell';

const GRID_MARGIN = 6;
const MIN_CELL_HEIGHT = 80;

function cellHeightForAvailable(available: number, rows: number): number {
  return Math.max(Math.floor(available / rows), MIN_CELL_HEIGHT);
}

function attachPortalMount(contentEl: Element): HTMLElement {
  const existing = contentEl.querySelector('.mc-portal-mount');
  if (existing instanceof HTMLElement) return existing;

  const mountEl = document.createElement('div');
  mountEl.className = 'mc-portal-mount';
  mountEl.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  contentEl.append(mountEl);
  return mountEl;
}

function toGridStackWidget(w: WidgetDef) {
  return {
    id: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: w.minW ?? 2,
    minH: w.minH ?? 2,
  };
}

/* ─── Public imperative handle ─── */
export interface ModularCanvasHandle {
  addWidget: (id: string) => void;
  removeWidget: (id: string) => void;
  getActiveWidgetIds: () => string[];
}

/* ─── Props ─── */
interface ModularCanvasProps {
  defaultLayout: WidgetDef[];
  locked: boolean;
  widgetMeta: Record<string, WidgetMeta>;
  renderWidget: (widgetId: string) => ReactNode;
  /** Extra ReactNode rendered in the drag-handle area per widget */
  widgetHeaderExtras?: Record<string, ReactNode>;
  onWidgetIdsChange?: (ids: string[]) => void;
}

/* ─── Component ─── */
const ModularCanvas = forwardRef<ModularCanvasHandle, ModularCanvasProps>(function ModularCanvas(
  { defaultLayout, locked, widgetMeta, renderWidget, widgetHeaderExtras, onWidgetIdsChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridElRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);
  const lockedRef = useRef(locked);
  const [portalTargets, setPortalTargets] = useState<Record<string, HTMLElement>>({});
  const [widgetIds, setWidgetIds] = useState<string[]>([]);

  lockedRef.current = locked;

  const syncPortalTargets = useCallback((gs: GridStack) => {
    const targets: Record<string, HTMLElement> = {};
    const ids: string[] = [];

    for (const el of gs.getGridItems()) {
      const id = el.gridstackNode?.id;
      if (!id) continue;

      const contentEl = el.querySelector('.grid-stack-item-content');
      if (!contentEl) continue;

      targets[id] = attachPortalMount(contentEl);
      ids.push(id);
    }

    setPortalTargets(targets);
    setWidgetIds(ids);
  }, []);

  const buildWidgets = useCallback(
    (layout: WidgetDef[], gs: GridStack) => {
      gs.batchUpdate();
      gs.removeAll(true);
      gs.load(layout.map(toGridStackWidget));
      gs.batchUpdate(false);
      syncPortalTargets(gs);
    },
    [syncPortalTargets],
  );

  const persistLayout = useCallback((gs: GridStack) => {
    const saved = gs.save(false);
    if (Array.isArray(saved)) {
      writeSavedLayout(saved);
    }
  }, []);

  /* ── Dynamic cell height — fills available vertical space ── */
  const computeCellHeight = useCallback(() => {
    const gs = gridRef.current;
    const container = containerRef.current;
    if (!gs || !container) return;

    const style = getComputedStyle(container);
    const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const available = container.getBoundingClientRect().height - paddingY;
    if (available <= 0) return;

    const rows = Math.max(gs.getRow(), GRID_ROWS);
    const nextHeight = cellHeightForAvailable(available, rows);
    if (gs.getCellHeight(true) === nextHeight) return;

    gs.batchUpdate();
    gs.cellHeight(nextHeight);
    for (const el of gs.getGridItems()) {
      const node = el.gridstackNode;
      if (!node) continue;
      gs.update(el, { x: node.x, y: node.y, w: node.w, h: node.h });
    }
    gs.batchUpdate(false);
  }, []);

  /* ── Initialize GridStack on mount ── */
  useEffect(() => {
    const container = gridElRef.current;
    if (!container) return;

    const gridHost = container as GridHTMLElement;
    gridHost.gridstack?.destroy(false);
    gridHost.querySelectorAll(':scope > .grid-stack-item').forEach((el) => el.remove());

    const gs = GridStack.init(
      {
        column: 12,
        minRow: GRID_ROWS,
        cellHeight: MIN_CELL_HEIGHT,
        margin: GRID_MARGIN,
        float: false,
        animate: true,
        staticGrid: lockedRef.current,
        draggable: { handle: '.mc-draghandle' },
        resizable: { handles: 'e,se,s,sw,w' },
      },
      container,
    );

    gridRef.current = gs;

    const initialLayout = readSavedLayout(widgetMeta) ?? defaultLayout;
    buildWidgets(initialLayout, gs);

    const onChange = () => {
      syncPortalTargets(gs);
      if (!lockedRef.current) {
        persistLayout(gs);
      }
      computeCellHeight();
    };
    gs.on('change', onChange);

    requestAnimationFrame(() => computeCellHeight());

    return () => {
      gs.off('change');
      gs.destroy(false);
      gridRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Keep grid rows filling the canvas as the viewport/header changes ── */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    computeCellHeight();

    const ro = new ResizeObserver(() => computeCellHeight());
    ro.observe(container);

    const onWindowResize = () => computeCellHeight();
    window.addEventListener('resize', onWindowResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [computeCellHeight]);

  useEffect(() => {
    const gs = gridRef.current;
    if (!gs) return;
    gs.setStatic(locked);
  }, [locked]);

  useEffect(() => {
    onWidgetIdsChange?.(widgetIds);
  }, [widgetIds, onWidgetIdsChange]);

  const addWidgetFn = useCallback(
    (wid: string) => {
      const gs = gridRef.current;
      if (!gs || widgetIds.includes(wid)) return;

      const meta = widgetMeta[wid];
      const el = gs.addWidget({
        id: wid,
        w: meta?.defaultW ?? 4,
        h: meta?.defaultH ?? 4,
        minW: meta?.minW ?? 2,
        minH: meta?.minH ?? 2,
      });

      const contentEl = el.querySelector('.grid-stack-item-content');
      if (contentEl) {
        const mountEl = attachPortalMount(contentEl);
        setPortalTargets((prev) => ({ ...prev, [wid]: mountEl }));
        setWidgetIds((prev) => [...prev, wid]);
        if (!lockedRef.current) {
          persistLayout(gs);
        }
        computeCellHeight();
      }
    },
    [widgetIds, widgetMeta, persistLayout, computeCellHeight],
  );

  const removeWidgetFn = useCallback(
    (wid: string) => {
      const gs = gridRef.current;
      if (!gs) return;

      const items = gs.getGridItems();
      const item = items.find((el) => el.gridstackNode?.id === wid);
      if (item) {
        gs.removeWidget(item, true);
        setPortalTargets((prev) => {
          const next = { ...prev };
          delete next[wid];
          return next;
        });
        setWidgetIds((prev) => prev.filter((id) => id !== wid));
        if (!lockedRef.current) {
          persistLayout(gs);
        }
        computeCellHeight();
      }
    },
    [persistLayout, computeCellHeight],
  );

  useImperativeHandle(
    ref,
    () => ({
      addWidget: addWidgetFn,
      removeWidget: removeWidgetFn,
      getActiveWidgetIds: () => widgetIds,
    }),
    [addWidgetFn, removeWidgetFn, widgetIds],
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <style>{GRIDSTACK_STYLES}</style>

      <div
        ref={containerRef}
        className={`flex-1 min-h-0 overflow-x-hidden relative p-1.5 ${
          locked ? 'overflow-hidden' : 'overflow-y-auto'
        } ${!locked ? 'mc-editing' : ''}`}
      >
        <div ref={gridElRef} className="grid-stack h-full" />
      </div>

      {widgetIds.map((wid) => {
        const target = portalTargets[wid];
        if (!target) return null;
        const meta = widgetMeta[wid];
        return createPortal(
          <WidgetShell
            key={wid}
            icon={meta?.icon ?? '📦'}
            label={meta?.label ?? wid}
            locked={locked}
            headerExtras={widgetHeaderExtras?.[wid]}
            onRemove={() => removeWidgetFn(wid)}
          >
            {renderWidget(wid)}
          </WidgetShell>,
          target,
          wid,
        );
      })}
    </div>
  );
});

export default ModularCanvas;
