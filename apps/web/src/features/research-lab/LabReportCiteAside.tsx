import { Description as DescriptionIcon } from '@mui/icons-material';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { citationPillLabel } from './model/reportDocument';
import { useLabReportCite } from './reportCiteContext';

/** One gutter card per inline cite pill (not per paragraph). */
type GutterCard = {
  /** Stable key: citationId + occurrence index in document order. */
  key: string;
  citationId: string;
  occurrence: number;
  blockId: string | null;
  /** Pill top relative to editor root. */
  top: number;
};

type PackedCard = GutterCard & { packedTop: number };

const CARD_GAP = 10;
const EST_COMPACT = 56;

/** Push cards down so absolute gutters never share the same Y band. */
function packCards(cards: GutterCard[], heightByKey: Record<string, number>): PackedCard[] {
  const sorted = [...cards].toSorted((a, b) => a.top - b.top || a.key.localeCompare(b.key));
  let cursor = Number.NEGATIVE_INFINITY;
  return sorted.map((card) => {
    const height = heightByKey[card.key] ?? EST_COMPACT;
    const packedTop = Math.max(card.top, cursor === Number.NEGATIVE_INFINITY ? card.top : cursor);
    cursor = packedTop + height + CARD_GAP;
    return { ...card, packedTop };
  });
}

/**
 * Evidence gutter: compact cards only. Detail opens via CitationPopover on the
 * editor (click → scroll/flash pill + popover).
 */
export default function LabReportCiteAside({
  editorRoot,
  scrollTop,
}: {
  editorRoot: HTMLElement | null;
  scrollTop: number;
}) {
  const { citations, orphanIds, showCitations, activeCiteKey, onCite } = useLabReportCite();

  const [cards, setCards] = useState<GutterCard[]>([]);
  const [heightByKey, setHeightByKey] = useState<Record<string, number>>({});
  const cardEls = useRef(new Map<string, HTMLElement>());

  useLayoutEffect(() => {
    if (!editorRoot || !showCitations) {
      setCards([]);
      return;
    }
    const articleTop = editorRoot.getBoundingClientRect().top;
    const pills = editorRoot.querySelectorAll<HTMLElement>('button[data-cite-id]');
    const next: GutterCard[] = [];
    const occ = new Map<string, number>();

    pills.forEach((pill) => {
      const citationId = pill.dataset.citeId;
      if (!citationId) return;
      const n = occ.get(citationId) ?? 0;
      occ.set(citationId, n + 1);
      const host = pill.closest('[data-lab-block-id]');
      const blockId = host instanceof HTMLElement ? (host.dataset.labBlockId ?? null) : null;
      const rect = pill.getBoundingClientRect();
      next.push({
        key: `${citationId}#${n}`,
        citationId,
        occurrence: n,
        blockId,
        top: rect.top - articleTop,
      });
    });
    setCards(next);
  }, [editorRoot, showCitations, scrollTop, activeCiteKey, citations]);

  const packed = useMemo(() => packCards(cards, heightByKey), [cards, heightByKey]);

  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    let changed = false;
    for (const card of packed) {
      const el = cardEls.current.get(card.key);
      if (!el) continue;
      const h = Math.ceil(el.getBoundingClientRect().height);
      next[card.key] = h;
      if (heightByKey[card.key] !== h) changed = true;
    }
    if (changed) {
      setHeightByKey((prev) => ({ ...prev, ...next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid height↔pack loop
  }, [packed.map((c) => c.key).join(','), scrollTop]);

  if (!showCitations) return null;

  const contentHeight = Math.max(
    400,
    ...packed.map((c) => c.packedTop + (heightByKey[c.key] ?? EST_COMPACT) + 48),
    0,
  );

  return (
    <aside className="relative w-[min(280px,32vw)] shrink-0 overflow-hidden border-l border-gray-200 bg-gray-50">
      <div
        className="absolute left-0 right-0 top-0 px-3 will-change-transform"
        style={{ transform: `translateY(${-scrollTop}px)` }}
      >
        <div className="h-10" />
        {packed.map((card) => {
          const c = citations[card.citationId];
          if (!c) return null;
          const isFocus = activeCiteKey === card.key;

          return (
            <div
              key={card.key}
              ref={(el) => {
                if (el) cardEls.current.set(card.key, el);
                else cardEls.current.delete(card.key);
              }}
              className="absolute left-3 right-3 z-10"
              style={{ top: card.packedTop }}
            >
              <button
                type="button"
                onClick={() => {
                  onCite(c.id, { occurrence: card.occurrence });
                }}
                className={`w-full rounded-md border px-2.5 py-1.5 text-left text-[11px] leading-snug shadow-sm transition-opacity hover:border-blue-300 ${
                  isFocus || !activeCiteKey ? 'opacity-100' : 'opacity-45'
                } ${
                  orphanIds.has(c.id)
                    ? 'border-amber-200 bg-amber-50/80'
                    : isFocus
                      ? 'border-blue-300 bg-blue-50/80'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <div className="mb-0.5 text-[9px] font-medium text-blue-600/80">
                  {citationPillLabel(c, c.id)}
                  {orphanIds.has(c.id) ? ' · 正文已移除' : ''}
                </div>
                <div className="line-clamp-2 font-medium text-gray-800">{c.title}</div>
              </button>
            </div>
          );
        })}
        <div style={{ height: contentHeight }} />
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-md border border-gray-200 bg-white/95 px-2 py-1 text-[10px] text-gray-500">
        <DescriptionIcon sx={{ fontSize: 11, verticalAlign: 'middle', mr: 0.5 }} />
        点击对齐正文并查看引用
      </div>
    </aside>
  );
}
