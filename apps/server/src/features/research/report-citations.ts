/**
 * Research report citation bind + synthesize failure / JSON repair helpers.
 */
import type { ResearchEvidence, ResearchReport } from '@crystalith/shared';

export const SYNTHESIZE_FAILED_PREFIX = 'synthesize_failed:';
export const SYNTHESIZE_MODEL_ERROR_PREFIX = 'synthesize_model_error:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asDisplayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    return String(value);
  }
  return '';
}

export function isSynthesizeFailureReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return (
    reason.startsWith(SYNTHESIZE_FAILED_PREFIX) || reason.startsWith(SYNTHESIZE_MODEL_ERROR_PREFIX)
  );
}

/** Collect all cite keys the model claimed (map keys + inline citeIds). */
export function collectClaimedCiteIds(report: ResearchReport): Set<string> {
  const ids = new Set<string>();
  for (const key of Object.keys(report.citations ?? {})) ids.add(key);
  for (const section of report.sections) {
    for (const block of section.blocks) {
      if (block.type === 'paragraph') {
        for (const id of block.citeIds) ids.add(id);
      } else {
        for (const item of block.items) {
          for (const id of item.citeIds) ids.add(id);
        }
      }
    }
  }
  return ids;
}

function citationFromEvidence(ev: ResearchEvidence): ResearchReport['citations'][string] {
  return {
    sourceName: ev.title,
    snippet: ev.snippet ?? ev.title,
    url: ev.url,
    sourceId: ev.sourceId,
    chunkId: ev.chunkId,
  };
}

/**
 * Bind cites to Run evidence map: strip illegal keys; fail only when model claimed
 * cites and none remain legal (all-illegal / hallucinated).
 */
export function validateAndBindCitations(
  report: ResearchReport,
  evidences: ResearchEvidence[],
): { ok: true; report: ResearchReport } | { ok: false; reason: string } {
  const byId = new Map(evidences.map((e) => [e.id, e]));
  const claimed = collectClaimedCiteIds(report);
  const legalKeys = new Set([...claimed].filter((id) => byId.has(id)));

  if (claimed.size > 0 && legalKeys.size === 0) {
    return { ok: false, reason: 'claimed cites all illegal' };
  }

  const filterIds = (ids: string[]) => ids.filter((id) => legalKeys.has(id));
  const sections = report.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      if (block.type === 'paragraph') {
        return { ...block, citeIds: filterIds(block.citeIds) };
      }
      return {
        ...block,
        items: block.items.map((item) => ({ ...item, citeIds: filterIds(item.citeIds) })),
      };
    }),
  }));

  const citations: ResearchReport['citations'] = {};
  for (const id of legalKeys) {
    const ev = byId.get(id)!;
    const fromModel = report.citations[id];
    citations[id] = fromModel
      ? {
          ...citationFromEvidence(ev),
          ...fromModel,
          sourceName: fromModel.sourceName || ev.title,
          // intentionally || — empty snippet falls back through evidence fields
          // oxlint-disable-next-line typescript/prefer-nullish-coalescing
          snippet: fromModel.snippet || ev.snippet || ev.title,
        }
      : citationFromEvidence(ev);
  }

  return {
    ok: true,
    report: {
      title: report.title,
      sections,
      citations,
    },
  };
}

/**
 * Local / think models often emit fenced JSON, preamble, or omit `citations`.
 * Used by generateObject repair + unit tests (mirrors repairDecomposePlanText).
 */
export function repairResearchReportText(text: string): string | null {
  let trimmed = text.trim();
  if (!trimmed) return null;

  trimmed = trimmed.replaceAll(/<think>[\s\S]*?<\/think>/giu, '').trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  if (fenced?.[1]) trimmed = fenced[1].trim();

  const start = trimmed.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed.charAt(i);
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;

  try {
    const raw: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (!isRecord(raw)) return null;
    const obj = raw;
    if (typeof obj.title !== 'string') return null;
    if (!Array.isArray(obj.sections)) return null;
    if (
      obj.citations === null ||
      obj.citations === undefined ||
      typeof obj.citations !== 'object' ||
      Array.isArray(obj.citations)
    ) {
      obj.citations = {};
    }

    const citationsIn = isRecord(obj.citations) ? obj.citations : {};
    const citationsOut: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(citationsIn)) {
      if (!isRecord(value)) {
        citationsOut[key] = { sourceName: key, snippet: '' };
        continue;
      }
      const c = value;
      const repaired: Record<string, unknown> = {
        sourceName: typeof c.sourceName === 'string' && c.sourceName ? c.sourceName : key,
        snippet: typeof c.snippet === 'string' ? c.snippet : '',
      };
      if (typeof c.url === 'string') repaired.url = c.url;
      if (typeof c.sourceId === 'number' && Number.isInteger(c.sourceId) && c.sourceId > 0) {
        repaired.sourceId = c.sourceId;
      }
      if (typeof c.chunkId === 'number' || typeof c.chunkId === 'string') {
        repaired.chunkId = c.chunkId;
      }
      if (typeof c.chunkIndex === 'number' && Number.isInteger(c.chunkIndex)) {
        repaired.chunkIndex = c.chunkIndex;
      }
      citationsOut[key] = repaired;
    }
    obj.citations = citationsOut;

    obj.sections = obj.sections.map((section, idx) => {
      if (!isRecord(section)) {
        return {
          id: `s${idx + 1}`,
          heading: '节',
          blocks: [{ type: 'paragraph', text: String(section ?? ''), citeIds: [] }],
        };
      }
      const s = section;
      const id = typeof s.id === 'string' && s.id.trim() ? s.id : `s${idx + 1}`;
      const heading = typeof s.heading === 'string' ? s.heading : '节';
      const blocksRaw = Array.isArray(s.blocks) ? s.blocks : [];
      const blocks = blocksRaw.map((block) => {
        if (!isRecord(block)) {
          return { type: 'paragraph', text: String(block ?? ''), citeIds: [] };
        }
        const b = block;
        if (b.type === 'bullets') {
          const items = Array.isArray(b.items) ? b.items : [];
          return {
            type: 'bullets',
            items: items.map((item) => {
              if (!isRecord(item)) {
                return { text: String(item ?? ''), citeIds: [] };
              }
              const it = item;
              return {
                text: typeof it.text === 'string' ? it.text : asDisplayText(it.text),
                citeIds: Array.isArray(it.citeIds)
                  ? it.citeIds.filter((x): x is string => typeof x === 'string')
                  : [],
              };
            }),
          };
        }
        return {
          type: 'paragraph',
          text: typeof b.text === 'string' ? b.text : asDisplayText(b.text),
          citeIds: Array.isArray(b.citeIds)
            ? b.citeIds.filter((x): x is string => typeof x === 'string')
            : [],
        };
      });
      return { id, heading, blocks };
    });

    return JSON.stringify(obj);
  } catch {
    return null;
  }
}
