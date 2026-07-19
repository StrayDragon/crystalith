// Postprocess (v1 output_postprocess.py)

interface PostprocessResult {
  content: Record<string, unknown>;
  warnings: string[];
}

function postprocessOutput(object: unknown, type: string): PostprocessResult {
  const warnings: string[] = [];
  let content = (object && typeof object === 'object' ? object : {}) as Record<string, unknown>;

  // ensure_minimum_content: if the generated content is empty, use fallback
  if (Object.keys(content).length === 0 || isContentEmpty(content, type)) {
    warnings.push('Generated content was empty — using fallback');
    content = generateFallbackContent(type) as Record<string, unknown>;
  }

  // Detect "no content found" template responses from AI and convert to fallback.
  // When the AI has no relevant context, it often generates a polite "not found"
  // message as the first item instead of failing. These should be treated as
  // generation failures so the frontend shows the error+retry UI.
  if (isNoContentTemplate(content, type)) {
    warnings.push('AI generated placeholder content instead of real output — using fallback');
    content = generateFallbackContent(type) as Record<string, unknown>;
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
    if (!Array.isArray(content[key]) || (content[key] as unknown[]).length === 0) {
      content[key] = [];
    }
    return content[key] as unknown[];
  };
  const ensureString = (key: string, fallback = ''): void => {
    if (typeof content[key] !== 'string' || !content[key]) {
      content[key] = fallback;
    }
  };
  // A leaf entry that should carry a citation anchor
  const leaf = (text: string): Record<string, unknown> => ({ text, citations: [1] });

  switch (type) {
    case 'FAQ': {
      const items = ensureArray('items');
      for (const item of items) {
        if (item && typeof item === 'object' && !('citations' in item)) {
          (item as Record<string, unknown>).citations = [1];
        }
      }
      break;
    }
    case 'BULLETS': {
      const items = ensureArray('items');
      for (const item of items) {
        if (item && typeof item === 'object' && !('citations' in item)) {
          (item as Record<string, unknown>).citations = [1];
        }
      }
      break;
    }
    case 'TIMELINE': {
      const events = ensureArray('events');
      for (const ev of events) {
        if (ev && typeof ev === 'object' && !('citations' in ev)) {
          (ev as Record<string, unknown>).citations = [1];
        }
      }
      break;
    }
    case 'QUIZ': {
      const questions = ensureArray('questions');
      for (const q of questions) {
        if (q && typeof q === 'object' && !('citations' in q)) {
          (q as Record<string, unknown>).citations = [1];
        }
      }
      break;
    }
    case 'GUIDE': {
      const modules = ensureArray('modules');
      for (const mod of modules) {
        if (mod && typeof mod === 'object') {
          const m = mod as Record<string, unknown>;
          // backfill objective {text, citations:[1]}
          if (!m.objective || typeof m.objective !== 'object') {
            m.objective = leaf(
              typeof m.title === 'string' ? m.title : typeof m.title === 'string' ? m.title : '',
            );
          } else {
            const obj = m.objective as Record<string, unknown>;
            if (!Array.isArray(obj.citations)) obj.citations = [1];
          }
          // backfill keyPoints with at least one entry
          if (!Array.isArray(m.keyPoints) || (m.keyPoints as unknown[]).length === 0) {
            m.keyPoints = [
              leaf(
                typeof m.title === 'string' ? m.title : typeof m.title === 'string' ? m.title : '',
              ),
            ];
          }
          if (!Array.isArray(m.examples)) m.examples = [];
          if (!Array.isArray(m.exercises)) m.exercises = [];
        }
      }
      break;
    }
    case 'BRIEFING': {
      const sections = ensureArray('sections');
      for (const sec of sections) {
        if (sec && typeof sec === 'object') {
          const s = sec as Record<string, unknown>;
          if (!Array.isArray(s.points) || (s.points as unknown[]).length === 0) {
            s.points = [
              leaf(
                typeof s.heading === 'string'
                  ? s.heading
                  : typeof s.heading === 'string'
                    ? s.heading
                    : '',
              ),
            ];
          }
        }
      }
      break;
    }
    case 'MINDMAP': {
      if (!content.root || typeof content.root !== 'object') {
        content.root = { label: '', citations: [], children: [] };
      }
      const root = content.root as Record<string, unknown>;
      if (!Array.isArray(root.citations)) root.citations = [1];
      if (!Array.isArray(root.children) || (root.children as unknown[]).length === 0) {
        root.children = [
          {
            label:
              typeof root.label === 'string'
                ? root.label
                : typeof root.label === 'string'
                  ? root.label
                  : '',
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
  if (!content || typeof content !== 'object' || Array.isArray(content)) return true;
  const c = content as Record<string, unknown>;
  // already a fallback — don't repair
  if (c._fallback === true) return false;
  const isBlank = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';
  const items = c.items;
  switch (type) {
    case 'FAQ':
      if (!Array.isArray(items) || items.length === 0) return true;
      return items.some(
        (it) =>
          !it ||
          typeof it !== 'object' ||
          isBlank((it as Record<string, unknown>).question) ||
          isBlank((it as Record<string, unknown>).answer),
      );
    case 'BULLETS':
      if (!Array.isArray(items) || items.length === 0) return true;
      return items.some((it) => {
        if (typeof it === 'string') return isBlank(it);
        if (!it || typeof it !== 'object') return true;
        return isBlank((it as Record<string, unknown>).text);
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
      return !c.root || typeof c.root !== 'object';
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
      if (!first || typeof first !== 'object') return false;
      const f = first as Record<string, unknown>;
      return (
        hasNoContentPrefix(f.question) || hasNoContentPrefix(f.answer) || hasNoContentPrefix(f.text)
      );
    }
    case 'TIMELINE': {
      const events = content.events;
      if (!Array.isArray(events) || events.length === 0) return false;
      const first = events[0];
      if (!first || typeof first !== 'object') return false;
      const f = first as Record<string, unknown>;
      return hasNoContentPrefix(f.event) || hasNoContentPrefix(f.description);
    }
    case 'GUIDE': {
      const modules = content.modules;
      if (!Array.isArray(modules) || modules.length === 0) return false;
      const first = modules[0];
      if (!first || typeof first !== 'object') return false;
      const f = first as Record<string, unknown>;
      // Objective could be {text: string} or raw string
      const obj = f.objective;
      const objText =
        typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>).text : obj;
      return hasNoContentPrefix(f.title) || hasNoContentPrefix(objText);
    }
    case 'BRIEFING': {
      const sections = content.sections;
      if (!Array.isArray(sections) || sections.length === 0) return false;
      const first = sections[0];
      if (!first || typeof first !== 'object') return false;
      const f = first as Record<string, unknown>;
      return hasNoContentPrefix(f.heading);
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
