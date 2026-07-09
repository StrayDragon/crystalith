// Refine format helpers — LLM message construction, output formatting, and
// bullet parsing. Faithful port of v1 `refine/api.py` (FORMAT_PROMPTS,
// _build_messages, _apply_format, _fallback_structured) and
// `shared/utils/text.py` (parse_bullets), `shared/utils/chunk.py`
// (extract_page_number / extract_paragraph_index).
import type { Citation, RefineFormat } from '@crystalith/shared';

// ---------------------------------------------------------------------------
// FORMAT_PROMPTS (v1 api.py:91-98 — exact wording)
// ---------------------------------------------------------------------------

export const FORMAT_PROMPTS: Record<RefineFormat, string> = {
  paragraph: 'Summarize the sources into one concise paragraph.',
  bullets: 'Summarize the sources into bullet points (each on a new line).',
  structured:
    'Return JSON with keys: title (string), bullets (list of strings), terms (list of strings). Keep bullets concise.',
};

// ---------------------------------------------------------------------------
// buildRefineMessages (v1 api.py:155-166 / worker.py:55-66)
// ---------------------------------------------------------------------------

export function buildRefineMessages(
  format: RefineFormat,
  prompt: string,
  context: string,
): { system: string; user: string } {
  const formatPrompt = FORMAT_PROMPTS[format] ?? FORMAT_PROMPTS.paragraph;
  return {
    system: `You are a research assistant. Answer strictly using the provided sources. ${formatPrompt}`,
    user: `Prompt:\n${prompt}\n\nSources:\n${context}`,
  };
}

// ---------------------------------------------------------------------------
// parseBullets (v1 shared/utils/text.py:23-30 — exact behavior)
//
// Iterates each line, strips leading/trailing whitespace + a leading "-",
// then strips again. Keeps only non-empty results. Does NOT match "•", "*",
// or numbered prefixes — it processes ALL non-empty lines.
// ---------------------------------------------------------------------------

export function parseBullets(text: string): string[] {
  const items: string[] = [];
  for (const raw of text.split('\n')) {
    const cleaned = raw.trim().replace(/^-+/u, '').trim();
    if (cleaned) items.push(cleaned);
  }
  return items;
}

// ---------------------------------------------------------------------------
// _fallback_structured (v1 api.py:103-110 / worker.py:40-45)
// ---------------------------------------------------------------------------

export function fallbackStructured(
  prompt: string,
  citations: Citation[],
): { title: string; bullets: string[]; terms: string[]; citations: Citation[] } {
  const title = prompt.trim().slice(0, 48) || 'Refine';
  const bullets = citations.slice(0, 5).map((c) => c.snippet);
  return { title, bullets, terms: [], citations };
}

// ---------------------------------------------------------------------------
// applyFormat (v1 api.py:169-191 / worker.py:74-91)
//
// Returns only the format-specific key(s); the caller merges in
// { format, citations, evidence, created_at }.
// ---------------------------------------------------------------------------

export interface FormatOutput {
  paragraph?: string;
  bullets?: string[];
  structured?: { title: string; bullets: string[]; terms: string[]; citations: Citation[] };
}

export function applyFormat(
  format: RefineFormat,
  answer: string,
  prompt: string,
  citations: Citation[],
): FormatOutput {
  switch (format) {
    case 'paragraph':
      return { paragraph: answer.trim() };
    case 'bullets':
      return { bullets: parseBullets(answer) };
    case 'structured':
      try {
        const parsed = JSON.parse(answer) as Record<string, unknown>;
        return {
          structured: {
            // Explicit construction with defaults + str coercion (v1 api.py:182-186).
            title: String(parsed.title ?? ''),
            bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String) : [],
            terms: Array.isArray(parsed.terms) ? parsed.terms.map(String) : [],
            citations,
          },
        };
      } catch {
        return { structured: fallbackStructured(prompt, citations) };
      }
  }
}

// ---------------------------------------------------------------------------
// extractPageNumber / extractParagraphIndex (v1 shared/utils/chunk.py:11-22)
//
// v1 reads chunk.metadata["page"] / ["paragraph_index"]. Returns null if
// absent or non-numeric.
// ---------------------------------------------------------------------------

export function extractPageNumber(metadata: unknown): number | null {
  if (metadata && typeof metadata === 'object' && 'page' in metadata) {
    const val = Number((metadata as Record<string, unknown>).page);
    return Number.isFinite(val) ? val : null;
  }
  return null;
}

export function extractParagraphIndex(metadata: unknown): number | null {
  if (metadata && typeof metadata === 'object' && 'paragraph_index' in metadata) {
    const val = Number((metadata as Record<string, unknown>).paragraph_index);
    return Number.isFinite(val) ? val : null;
  }
  return null;
}
