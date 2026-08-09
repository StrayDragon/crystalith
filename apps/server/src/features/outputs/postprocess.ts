// Postprocess (v1 output_postprocess.py)

interface PostprocessResult {
  content: Record<string, unknown>;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function postprocessOutput(object: unknown, type: string): PostprocessResult {
  const warnings: string[] = [];
  let content: Record<string, unknown> = isRecord(object) ? object : {};

  // ensure_minimum_content: if the generated content is empty, use fallback
  if (Object.keys(content).length === 0 || isContentEmpty(content, type)) {
    warnings.push('Generated content was empty — using fallback');
    content = generateFallbackContent(type);
  }

  // Detect "no content found" template responses from AI and convert to fallback.
  // When the AI has no relevant context, it often generates a polite "not found"
  // message as the first item instead of failing. These should be treated as
  // generation failures so the frontend shows the error+retry UI.
  if (isNoContentTemplate(content, type)) {
    warnings.push('AI generated placeholder content instead of real output — using fallback');
    content = generateFallbackContent(type);
  }

  // c42: per-type field-level backfill (v1 _ensure_minimum_content output_graph.py:290-375)
  content = ensureMinimumContentFields(content, type);

  return { content, warnings };
}

/**
 * c59: per-type nested structure backfill (v1 ensure_minimum_content,
 * output_postprocess.py:102-189). Unlike the old shallow ensureArray, this
 * backfills nested {text, citations:[1]} structures so incomplete content
 * carries a citation anchor instead of leaving bare [].
 */
export function ensureMinimumContentFields(
  content: Record<string, unknown>,
  type: string,
): Record<string, unknown> {
  const ensureArray = (key: string): unknown[] => {
    const value = content[key];
    if (!Array.isArray(value) || value.length === 0) {
      content[key] = [];
      return [];
    }
    return value;
  };
  const ensureString = (key: string, fallback = ''): void => {
    if (typeof content[key] !== 'string' || !content[key]) {
      content[key] = fallback;
    }
  };
  // A leaf entry that should carry a citation anchor
  const leaf = (text: string): Record<string, unknown> => ({ text, citations: [1] });
  const ensureCitations = (entries: unknown[]): void => {
    for (const entry of entries) {
      if (isRecord(entry) && !('citations' in entry)) {
        entry.citations = [1];
      }
    }
  };

  switch (type) {
    case 'FAQ':
      ensureCitations(ensureArray('items'));
      break;
    case 'BULLETS':
      ensureCitations(ensureArray('items'));
      break;
    case 'TIMELINE':
      ensureCitations(ensureArray('events'));
      break;
    case 'QUIZ':
      ensureCitations(ensureArray('questions'));
      break;
    case 'GUIDE': {
      const modules = ensureArray('modules');
      for (const mod of modules) {
        if (!isRecord(mod)) continue;
        // backfill objective {text, citations:[1]}
        if (!isRecord(mod.objective)) {
          mod.objective = leaf(asString(mod.title));
        } else if (!Array.isArray(mod.objective.citations)) {
          mod.objective.citations = [1];
        }
        // backfill keyPoints with at least one entry
        if (!Array.isArray(mod.keyPoints) || mod.keyPoints.length === 0) {
          mod.keyPoints = [leaf(asString(mod.title))];
        }
        if (!Array.isArray(mod.examples)) mod.examples = [];
        if (!Array.isArray(mod.exercises)) mod.exercises = [];
      }
      break;
    }
    case 'BRIEFING': {
      const sections = ensureArray('sections');
      for (const sec of sections) {
        if (!isRecord(sec)) continue;
        if (!Array.isArray(sec.points) || sec.points.length === 0) {
          sec.points = [leaf(asString(sec.heading))];
        }
      }
      break;
    }
    case 'MINDMAP': {
      const root: Record<string, unknown> = isRecord(content.root)
        ? content.root
        : { label: '', citations: [], children: [] };
      content.root = root;
      if (!Array.isArray(root.citations)) root.citations = [1];
      if (!Array.isArray(root.children) || root.children.length === 0) {
        root.children = [
          {
            label: asString(root.label),
            citations: [1],
            children: [],
          },
        ];
      }
      break;
    }
    case 'PARAGRAPH':
      ensureString('text');
      if (!Array.isArray(content.citations)) content.citations = [1];
      break;
    case 'STRUCTURED':
      ensureArray('bullets');
      ensureArray('terms');
      break;
  }
  return content;
}

/**
 * c50: detect whether generated output has salvageable-but-incomplete content
 * worth a second LLM pass (v1 `needs_repair`, output_postprocess.py:192-290).
 *
 * Returns false for fallback content (already errored) — no point repairing.
 * Returns true when the content is structurally present but has blank/missing
 * required fields (e.g. empty question text, missing module title).
 */
export function needsRepair(type: string, content: unknown): boolean {
  if (!isRecord(content)) return true;
  const c = content;
  // already a fallback — don't repair
  if (c._fallback === true) return false;
  const isBlank = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';
  const items = c.items;
  switch (type) {
    case 'FAQ':
      if (!Array.isArray(items) || items.length === 0) return true;
      return items.some((it) => !isRecord(it) || isBlank(it.question) || isBlank(it.answer));
    case 'BULLETS':
      if (!Array.isArray(items) || items.length === 0) return true;
      return items.some((it) => {
        if (typeof it === 'string') return isBlank(it);
        if (!isRecord(it)) return true;
        return isBlank(it.text);
      });
    case 'TIMELINE':
      return !Array.isArray(c.events) || c.events.length === 0;
    case 'QUIZ':
      return !Array.isArray(c.questions) || c.questions.length === 0;
    case 'GUIDE':
      return !Array.isArray(c.modules) || c.modules.length === 0;
    case 'BRIEFING':
      return !Array.isArray(c.sections) || c.sections.length === 0;
    case 'MINDMAP':
      return !isRecord(c.root);
    case 'PARAGRAPH':
      return isBlank(c.text);
    default:
      return false;
  }
}

/** Check if the content object has meaningful data for its type. */
function isContentEmpty(content: Record<string, unknown>, type: string): boolean {
  switch (type) {
    case 'FAQ':
    case 'BULLETS':
      return !Array.isArray(content.items) || content.items.length === 0;
    case 'TIMELINE':
      return !Array.isArray(content.events) || content.events.length === 0;
    case 'QUIZ':
      return !Array.isArray(content.questions) || content.questions.length === 0;
    case 'GUIDE':
      return !Array.isArray(content.modules) || content.modules.length === 0;
    case 'BRIEFING':
      return !Array.isArray(content.sections) || content.sections.length === 0;
    case 'MINDMAP':
      return !content.root;
    case 'PARAGRAPH':
      return !content.text;
    default:
      return false;
  }
}

/** Known prefixes that indicate AI generated a "no content found" template
 * instead of real content. Checked against the first item's text field. */
const NO_CONTENT_PREFIXES = [
  '由于您提供的上下文显示',
  '未找到相关内容',
  '未找到与',
  '无法生成',
  '以下提供标准',
];

/**
 * Detect whether AI-generated content is a "no content found" template response
 * rather than real content. The AI sometimes politely declines to generate when
 * context is insufficient, producing valid JSON with templated messages.
 * These should be treated as generation failures.
 */
function isNoContentTemplate(content: Record<string, unknown>, type: string): boolean {
  // Helper: check if a text value matches any known "not found" prefix
  const hasNoContentPrefix = (text: unknown): boolean => {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    return NO_CONTENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  };

  switch (type) {
    case 'FAQ':
    case 'BULLETS': {
      const items = content.items;
      if (!Array.isArray(items) || items.length === 0) return false;
      const first = items[0];
      if (!isRecord(first)) return false;
      return (
        hasNoContentPrefix(first.question) ||
        hasNoContentPrefix(first.answer) ||
        hasNoContentPrefix(first.text)
      );
    }
    case 'TIMELINE': {
      const events = content.events;
      if (!Array.isArray(events) || events.length === 0) return false;
      const first = events[0];
      if (!isRecord(first)) return false;
      return hasNoContentPrefix(first.event) || hasNoContentPrefix(first.description);
    }
    case 'GUIDE': {
      const modules = content.modules;
      if (!Array.isArray(modules) || modules.length === 0) return false;
      const first = modules[0];
      if (!isRecord(first)) return false;
      // Objective could be {text: string} or raw string
      const obj = first.objective;
      const objText = isRecord(obj) ? obj.text : obj;
      return hasNoContentPrefix(first.title) || hasNoContentPrefix(objText);
    }
    case 'BRIEFING': {
      const sections = content.sections;
      if (!Array.isArray(sections) || sections.length === 0) return false;
      const first = sections[0];
      if (!isRecord(first)) return false;
      return hasNoContentPrefix(first.heading);
    }
    default:
      return false;
  }
}

/** Generate fallback content matching v1 output_graph.py:198-287 exactly.
 * Uses friendly error note (not raw exception), `label` for MINDMAP,
 * `citations: []` on every leaf so mapCitationsIntoContent can attach fallback.
 *
 * c59: title/question text comes from the user's `prompt` (truncated), NOT
 * error.message — v1 uses the user's prompt (output_postprocess.py:16). */
export function generateFallbackContent(
  type: string,
  prompt?: string,
  _error?: unknown,
): Record<string, unknown> {
  const errorNote = '⚠️ AI 模型生成失败，请稍后重试或使用更强大的模型。';
  const _fallback = true;
  // c59: use user prompt as visible title (v1 _fallback_output(prompt, ...))
  // intentionally || — empty prompt uses empty string before slice
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  const title = (prompt || '').trim().slice(0, 200);

  switch (type) {
    case 'FAQ':
      return {
        items: [{ question: title || errorNote, answer: errorNote, citations: [] }],
        _fallback,
      };
    case 'GUIDE':
      return {
        modules: [
          {
            title: title || errorNote,
            objective: { text: errorNote, citations: [] },
            keyPoints: [],
            examples: [],
            exercises: [],
          },
        ],
        _fallback,
      };
    case 'TIMELINE':
      return {
        events: [{ date: '—', event: title || errorNote, description: errorNote, citations: [] }],
        _fallback,
      };
    case 'MINDMAP':
      return {
        root: { label: title || errorNote, citations: [], children: [] },
        _fallback,
      };
    case 'QUIZ':
      return {
        questions: [
          {
            type: 'short_answer',
            question: title || errorNote,
            options: [],
            answer: errorNote,
            explanation: '',
            citations: [],
          },
        ],
        _fallback,
      };
    case 'BRIEFING':
      return {
        sections: [{ heading: title || '生成失败', points: [{ text: errorNote, citations: [] }] }],
        _fallback,
      };
    case 'PARAGRAPH':
      return { text: errorNote, citations: [], _fallback };
    case 'BULLETS':
      return { items: [{ text: errorNote, citations: [] }], _fallback };
    case 'STRUCTURED':
      return {
        title: title || '生成失败',
        bullets: [{ text: errorNote, citations: [] }],
        terms: [],
        _fallback,
      };
    default:
      return { _fallback };
  }
}

export { postprocessOutput };
