import type { QaControls } from '@crystalith/shared';

// QA presets — system prompt templates for different conversation modes.
//
// Replaces v1 `features/qa/presets.py` with a typed TS record.
// Each preset has a name (used in UI) and a system prompt template.
// Special directives like `@(Sources_only)` are parsed at runtime before
// injection.
//
// c122 typed-generation-framework: preset resolution is whitelist-based
// across built-in + custom presets (r23), enabled-checked (r25), and the
// bare `/prompt:<name>` form is a deterministic input error (r422).
import { client, db } from '../../db/index.ts';
import { promptPresets } from '../../db/schema.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';

interface QAPreset {
  name: string;
  /** Short label for the UI dropdown. */
  label: string;
  /** System prompt template. Supports `{{directive}}` placeholder. */
  systemPrompt: string;
}

/** Directive tokens that are replaced at runtime with dynamic context. */
export type Directive = 'Sources_only' | 'Knowledge_only' | 'Mixed';

/** Built-in QA preset names (UI + `/prompt:` directive). */
type QAPresetName = 'default' | 'analysis' | 'creative' | 'explainer' | 'stats';

/**
 * c48: STATS_SYSTEM_PROMPT — verbatim port of v1 presets.py:59-66.
 * Instructs the model to return a single JSON object with
 * fallback_markdown / chart / table(optional), no code fences, no extra text.
 */
export const STATS_SYSTEM_PROMPT = `You are a research assistant. Answer ONLY using the provided sources. Return a SINGLE JSON object with keys: fallback_markdown, chart, table (optional). Do NOT wrap the JSON in code fences. Do NOT include any extra text before or after the JSON. fallback_markdown MUST be non-empty, human-readable, and SHOULD include inline citations like [1], [2]. chart MUST include: title (string), unit (optional string), items (array of {label, value:number}). table (optional) MUST include: columns (string[]), rows ((string|number|null)[][]).`;

/** Preset registry (add new presets here). Keep Record<string, …> for runtime string lookup. */
const PRESETS: Record<string, QAPreset> = {
  default: {
    name: 'default',
    label: '精确问答',
    systemPrompt: `You are a helpful RAG assistant. Answer the user's question based on the provided context.

Rules:
1. Base your answer on the retrieved sources — cite them using [N] notation (e.g., [1], [2]).
2. If the context doesn't contain enough information, say so honestly.
3. Use the 'retrieveSources' tool to search for relevant information before answering.
4. Be concise and precise.
{{directive}}`,
  },

  analysis: {
    name: 'analysis',
    label: '深度分析',
    systemPrompt: `You are a deep analysis assistant. Go beyond surface-level answers:

1. Identify patterns, contradictions, and implications across multiple sources.
2. Compare and contrast different perspectives when available.
3. Surface non-obvious connections.
4. Provide synthesized insights, not just source summaries.
5. Use the 'retrieveSources' tool to gather context — search broadly.
{{directive}}`,
  },

  creative: {
    name: 'creative',
    label: '创意激发',
    systemPrompt: `You are a creative ideation assistant.

1. Generate novel connections, perspectives, and ideas from the source material.
2. Use brainstorming techniques.
3. Propose unconventional angles.
4. Use the 'retrieveSources' tool to pull in wide-ranging context.
{{directive}}`,
  },

  explainer: {
    name: 'explainer',
    label: '讲解模式',
    systemPrompt: `You are a patient, educational assistant.

1. Explain concepts step-by-step from first principles.
2. Use analogies and concrete examples to illustrate.
3. Anticipate follow-up questions and address them proactively.
4. Use the 'retrieveSources' tool to ground your explanation in source material.
{{directive}}`,
  },

  // c48: stats preset (v1 presets.py:33-99). Returns a structured JSON object
  // (chart + optional table) via a dedicated system prompt; the QA handler
  // parses the JSON and surfaces fallback_markdown as the answer.
  stats: {
    name: 'stats',
    label: '统计图表',
    systemPrompt: STATS_SYSTEM_PROMPT,
  },
} satisfies Record<QAPresetName, QAPreset>;

/** Directive templates — injected at `{{directive}}` depending on user selection. */
const DIRECTIVES = {
  Sources_only:
    'CRITICAL: Only use information from the retrieved sources. Do NOT use external knowledge.',
  Knowledge_only: 'Use your knowledge freely. Only consult sources if explicitly needed.',
  Mixed: 'Use both retrieved sources and your own knowledge. Prioritize high-quality sources.',
} as const satisfies Record<Directive, string>;

/** List available preset names for UI. */
export function listPresets(): { name: string; label: string }[] {
  return Object.values(PRESETS).map(({ name, label }) => ({ name, label }));
}

/**
 * Parse `/prompt:<preset> <query>` from question text (v1 presets.py:9-30).
 * Requires whitespace after the preset name so bare `/prompt:stats` does not match.
 */
export function parsePromptDirective(
  question: string,
  bodyPreset?: string,
): { preset: string; question: string } {
  const match = question.match(/^\/prompt:([a-z0-9_-]{1,32})\s+/iu);
  if (match) {
    return { preset: match[1].toLowerCase(), question: question.slice(match[0].length) };
  }
  return { preset: (bodyPreset ?? 'default').toLowerCase(), question };
}

/**
 * r422: detect the bare `/prompt:<name>` form (directive name, no query text).
 * Returns the lowercased name, or null when the question is not a bare directive.
 */
export function detectBarePromptDirective(question: string): string | null {
  const match = question.match(/^\/prompt:([a-z0-9_-]{1,32})\s*$/iu);
  return match ? match[1].toLowerCase() : null;
}

/** Stable whitelist for errors/usage hints: built-in registry order + custom triggers (r23). */
export async function listAllPresetNames(): Promise<string[]> {
  const customTriggers = (
    await client().all(db().select({ trigger: promptPresets.trigger }).from(promptPresets))
  )
    .map((row) => row.trigger.trim().toLowerCase())
    .toSorted((a, b) => a.localeCompare(b));
  return [...Object.keys(PRESETS), ...customTriggers];
}

export interface QaPresetResolution {
  presetId: string;
  systemPromptTemplate: string;
  source: 'builtin' | 'custom';
}

/**
 * Whitelist preset resolution across built-in + custom presets (r23/r24/r25).
 * Unknown names and disabled customs are deterministic 400s; resolution order
 * is builtin registry first, then custom trigger (case-insensitive).
 */
export async function resolveQaPreset(name: string): Promise<QaPresetResolution> {
  const normalized = name.trim().toLowerCase();
  const builtin = PRESETS[normalized];
  if (builtin) {
    return {
      presetId: builtin.name,
      systemPromptTemplate: builtin.systemPrompt,
      source: 'builtin',
    };
  }
  const custom = (await client().all(db().select().from(promptPresets))).find(
    (row) => row.trigger.trim().toLowerCase() === normalized,
  );
  if (!custom) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Unknown preset: ${name}`, {
      availablePresets: await listAllPresetNames(),
    });
  }
  if (!custom.enabled) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Preset '${custom.trigger}' is disabled`, {
      presetId: custom.trigger,
    });
  }
  return {
    presetId: custom.trigger,
    systemPromptTemplate: custom.systemPrompt,
    source: 'custom',
  };
}

/**
 * Render a preset system prompt template with the selected directive.
 * Templates without a `{{directive}}` placeholder (e.g. stats, custom) are
 * returned unchanged.
 */
export function renderSystemPrompt(template: string, directive: Directive = 'Mixed'): string {
  if (!template.includes('{{directive}}')) return template;
  const directiveText = DIRECTIVES[directive];
  return template.replace('{{directive}}', directiveText ? `\n${directiveText}` : '');
}

const LENGTH_HINT_INSTRUCTIONS: Record<string, string | null> = {
  concise: 'Keep the answer concise and to the point.',
  balanced: null,
  comprehensive: 'Provide a comprehensive, in-depth answer covering multiple angles.',
};

/**
 * r186: apply structured constraint overrides as prompt instructions.
 * Returns the final system prompt plus the effective-controls echo (r189) —
 * only explicitly-set controls appear; null when none were set.
 */
export function applyQaControls(
  template: string,
  controls?: QaControls,
): { systemPrompt: string; effectiveControls: Record<string, unknown> | null } {
  const lines: string[] = [];
  const effective: Record<string, unknown> = {};
  if (controls?.lengthHint !== undefined) {
    effective.lengthHint = controls.lengthHint;
    const instruction = LENGTH_HINT_INSTRUCTIONS[controls.lengthHint];
    if (instruction) lines.push(instruction);
  }
  if (controls?.requireCitations !== undefined) {
    effective.requireCitations = controls.requireCitations;
    if (controls.requireCitations) {
      lines.push(
        'You MUST ground every claim in the retrieved sources and cite them using [N] notation.',
      );
    }
  }
  const suffix = lines.length
    ? `\n\nGeneration constraints:\n${lines.map((line) => `- ${line}`).join('\n')}`
    : '';
  return {
    systemPrompt: template + suffix,
    effectiveControls: Object.keys(effective).length > 0 ? effective : null,
  };
}

// ---------------------------------------------------------------------------
// c48: stats preset output (v1 presets.py:33-83, parse_stats_preset_output)
// ---------------------------------------------------------------------------

export interface StatsChartItem {
  label: string;
  value: number;
}
export interface StatsChart {
  title: string;
  unit?: string | null;
  items: StatsChartItem[];
}
export interface StatsTable {
  columns: string[];
  rows: Array<Array<string | number | null>>;
}
export interface StatsPresetOutput {
  fallback_markdown: string;
  chart: StatsChart;
  table?: StatsTable | null;
}

/**
 * Parse an LLM stats-preset response into a validated StatsPresetOutput.
 * Tolerates surrounding prose / code fences by extracting the outermost JSON
 * object. Returns null when the payload cannot be validated (v1 behavior:
 * caller falls through to normal generation on null).
 *
 * Mirrors v1 `parse_stats_preset_output` (presets.py:67-83).
 */
export function parseStatsPresetOutput(text: string): StatsPresetOutput | null {
  const raw = text.trim();
  if (!raw) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      payload = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!isObject(payload)) return null;
  const fm = payload.fallback_markdown;
  const chart = payload.chart;
  if (typeof fm !== 'string' || fm.length === 0) return null;
  if (!isObject(chart) || typeof chart.title !== 'string' || chart.title.length === 0) return null;
  if (!Array.isArray(chart.items) || chart.items.length === 0) return null;
  const items: StatsChartItem[] = [];
  for (const it of chart.items) {
    if (!isObject(it) || typeof it.label !== 'string' || it.label.length === 0) return null;
    if (typeof it.value !== 'number') return null;
    items.push({ label: it.label, value: it.value });
  }
  const validatedChart: StatsChart = {
    title: chart.title,
    unit: typeof chart.unit === 'string' ? chart.unit : null,
    items,
  };
  let table: StatsTable | null | undefined = undefined;
  if (isObject(payload.table) && Array.isArray(payload.table.columns)) {
    const cols = payload.table.columns;
    if (!cols.every((c) => typeof c === 'string') || cols.length === 0) return null;
    const rawRows: unknown[] = Array.isArray(payload.table.rows) ? payload.table.rows : [];
    if (!rawRows.every(isStatsRow)) return null;
    table = { columns: cols, rows: rawRows };
  }
  return { fallback_markdown: fm, chart: validatedChart, table };
}

function isStatsCell(v: unknown): v is string | number | null {
  return v === null || typeof v === 'string' || typeof v === 'number';
}

function isStatsRow(v: unknown): v is Array<string | number | null> {
  return Array.isArray(v) && v.every(isStatsCell);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
