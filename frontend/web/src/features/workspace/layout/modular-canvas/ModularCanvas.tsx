import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

import type { WidgetDef, WidgetMeta } from './types';
import { GRID_ROWS } from './widgetRegistry';
import { GRIDSTACK_STYLES } from './modularCanvasStyles';
import WidgetShell from './WidgetShell';

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
const ModularCanvas = forwardRef<ModularCanvasHandle, ModularCanvasProps>(
  function ModularCanvas(
    { defaultLayout, locked, widgetMeta, renderWidget, widgetHeaderExtras, onWidgetIdsChange },
    ref,
  ) {
    const gridElRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<GridStack | null>(null);
    const [portalTargets, setPortalTargets] = useState<Record<string, HTMLElement>>({});
    const [widgetIds, setWidgetIds] = useState<string[]>([]);

    /* ── Build widgets from a layout array ── */
    const buildWidgets = useCallback((layout: WidgetDef[], gs: GridStack) => {
      gs.batchUpdate();
      gs.removeAll(false);

      const targets: Record<string, HTMLElement> = {};
      const ids: string[] = [];

      layout.forEach((w) => {
        const el = gs.addWidget({
          id: w.id,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          minW: w.minW ?? 2,
          minH: w.minH ?? 2,
        });

        const contentEl = el.querySelector('.grid-stack-item-content');
        if (contentEl) {
          const mountEl = document.createElement('div');
          mountEl.className = 'mc-portal-mount';
          mountEl.style.cssText =
            'display:flex;flex-direction:column;height:100%;overflow:hidden;';
          contentEl.appendChild(mountEl);
          targets[w.id] = mountEl;
          ids.push(w.id);
        }
      });

      gs.batchUpdate(false);
      setPortalTargets(targets);
      setWidgetIds(ids);
    }, []);

    /* ── Dynamic cell height — fills available vertical space ── */
    const computeCellHeight = useCallback(() => {
      const gs = gridRef.current;
      const el = gridElRef.current;
      if (!gs || !el) return;
      const parent = el.parentElement;
      if (!parent) return;
      // Subtract parent padding to get actual content area height
      const style = getComputedStyle(parent);
      const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      const available = parent.clientHeight - paddingY;
      if (available <= 0) return;
      // margin is 6 on each side → total gap per row = 12
      const ch = Math.floor((available - GRID_ROWS * 12) / GRID_ROWS);
      gs.cellHeight(Math.max(ch, 80));
    }, []);

    /* ── Initialize GridStack on mount ── */
    useEffect(() => {
      if (!gridElRef.current || gridRef.current) return;

      const container = gridElRef.current;

      const gs = GridStack.init(
        {
          column: 12,
          cellHeight: 100,
          margin: 6,
          float: false,
          animate: true,
          draggable: { handle: '.mc-draghandle' },
          resizable: { handles: 'e,se,s,sw,w' },
        },
        container,
      );

      gridRef.current = gs;

      // Build the initial layout
      buildWidgets(defaultLayout, gs);

      // Recalculate cell height after layout paint
      requestAnimationFrame(() => {
        computeCellHeight();
      });

      // Watch container resizes to keep cells filling height
      const ro = new ResizeObserver(() => computeCellHeight());
      if (container.parentElement) ro.observe(container.parentElement);

      return () => {
        ro.disconnect();
        gs.destroy(false);
        gridRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Sync lock state ── */
    useEffect(() => {
      const gs = gridRef.current;
      if (!gs) return;
      gs.enableMove(!locked);
      gs.enableResize(!locked);
    }, [locked]);

    /* ── Notify parent when widget ids change ── */
    useEffect(() => {
      onWidgetIdsChange?.(widgetIds);
    }, [widgetIds, onWidgetIdsChange]);

    /* ── Add a widget ── */
    const addWidgetFn = useCallback(
      (wid: string) => {
        const gs = gridRef.current;
        if (!gs) return;

        // Prevent duplicates
        if (widgetIds.includes(wid)) return;

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
          const mountEl = document.createElement('div');
          mountEl.className = 'mc-portal-mount';
          mountEl.style.cssText =
            'display:flex;flex-direction:column;height:100%;overflow:hidden;';
          contentEl.appendChild(mountEl);
          setPortalTargets((prev) => ({ ...prev, [wid]: mountEl }));
          setWidgetIds((prev) => [...prev, wid]);
        }
      },
      [widgetIds, widgetMeta],
    );

    /* ── Remove a widget ── */
    const removeWidgetFn = useCallback((wid: string) => {
      const gs = gridRef.current;
      if (!gs) return;

      const items = gs.getGridItems();
      const item = items.find((el) => el.gridstackNode?.id === wid);
      if (item) {
        gs.removeWidget(item, false);
        setPortalTargets((prev) => {
          const next = { ...prev };
          delete next[wid];
          return next;
        });
        setWidgetIds((prev) => prev.filter((id) => id !== wid));
      }
    }, []);

    /* ── Expose imperative methods ── */
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
      <>
        {/* GridStack style overrides */}
        <style>{GRIDSTACK_STYLES}</style>

        <div className={`flex-1 min-h-0 overflow-hidden p-1.5 ${!locked ? 'mc-editing' : ''}`}>
          <div ref={gridElRef} className="grid-stack" style={{ minHeight: '100%' }} />
        </div>

        {/* React Portals → each GridStack widget */}
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
      </>
    );
  },
);

export default ModularCanvas;
