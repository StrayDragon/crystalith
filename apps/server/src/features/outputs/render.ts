// Output type-aware text rendering — ports v1 `_extract_text_from_output`
// (api.py:515-693).
//
// Each output type (FAQ/TIMELINE/MINDMAP/QUIZ/etc.) is rendered into readable
// markdown. Used by:
//  - export endpoint (format=markdown)
//  - convert-to-source (type-aware chunking instead of raw JSON)
import type { OutputType } from '@crystalith/shared';

/** Coerce a JSON value to text (v1 _json_to_text). */
function jsonToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Render an output's content into human-readable markdown based on its type.
 * Mirrors v1 `_extract_text_from_output` (api.py:515-693).
 */
export function renderOutputToMarkdown(
  type: OutputType | string,
  content: Record<string, unknown> | null,
  prompt?: string | null,
): string {
  if (!content) return prompt ?? '';

  const parts: string[] = [];

  // Add title if present
  if (typeof content.title === 'string') {
    parts.push(`# ${jsonToText(content.title)}`);
  }

  switch (type) {
    case 'PARAGRAPH':
      renderParagraph(content, parts);
      break;
    case 'BULLETS':
      renderBullets(content, parts);
      break;
    case 'FAQ':
      renderFaq(content, parts);
      break;
    case 'TIMELINE':
      renderTimeline(content, parts);
      break;
    case 'QUIZ':
      renderQuiz(content, parts);
      break;
    case 'MINDMAP':
      renderMindmap(content, parts);
      break;
    case 'GUIDE':
      renderGuide(content, parts);
      break;
    case 'BRIEFING':
      renderBriefing(content, parts);
      break;
    case 'SLIDES':
      renderSlides(content, parts);
      break;
    case 'STRUCTURED':
      renderStructured(content, parts);
      break;
    default:
      // Unknown type — dump as JSON
      parts.push(JSON.stringify(content, null, 2));
  }

  if (parts.length === 0) {
    parts.push(JSON.stringify(content, null, 2));
  }

  // Add prompt as context if present
  if (prompt && !parts.join('\n').includes(prompt)) {
    parts.unshift(`> 提示: ${prompt}\n`);
  }

  return parts.join('\n\n').trim();
}

function renderParagraph(content: Record<string, unknown>, parts: string[]): void {
  const text = jsonToText(content.text).trim();
  if (text) parts.push(text);
}

function renderBullets(content: Record<string, unknown>, parts: string[]): void {
  const items = content.items;
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const text =
      typeof item === 'string' ? item : jsonToText((item as Record<string, unknown>)?.text);
    if (text) parts.push(`- ${text}`);
  }
}

function renderFaq(content: Record<string, unknown>, parts: string[]): void {
  const items = content.items;
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const d = item as Record<string, unknown>;
    const q = jsonToText(d.question);
    const a = jsonToText(d.answer);
    if (q) parts.push(`**Q: ${q}**`);
    if (a) parts.push(`A: ${a}`);
    parts.push('');
  }
}

function renderTimeline(content: Record<string, unknown>, parts: string[]): void {
  const events = content.events;
  if (!Array.isArray(events)) return;
  for (const event of events) {
    if (typeof event !== 'object' || event === null) continue;
    const d = event as Record<string, unknown>;
    const date = jsonToText(d.date);
    const title = jsonToText(d.event);
    const desc = jsonToText(d.description);
    parts.push(`**${date}** - ${title}`);
    if (desc) parts.push(`  ${desc}`);
  }
}

function renderQuiz(content: Record<string, unknown>, parts: string[]): void {
  const questions = content.questions;
  if (!Array.isArray(questions)) return;
  questions.forEach((q, i) => {
    if (typeof q !== 'object' || q === null) return;
    const d = q as Record<string, unknown>;
    const question = jsonToText(d.question);
    parts.push(`${i + 1}. ${question}`);
    const options = d.options;
    if (Array.isArray(options)) {
      for (const opt of options) parts.push(`   - ${jsonToText(opt)}`);
    }
    const answer = jsonToText(d.answer);
    if (answer) parts.push(`   答案: ${answer}`);
    parts.push('');
  });
}

function renderMindmap(content: Record<string, unknown>, parts: string[]): void {
  const root = content.root;
  if (typeof root !== 'object' || root === null) return;
  const traverse = (node: Record<string, unknown>, indent: number) => {
    const label = jsonToText(node.label);
    const prefix = '  '.repeat(indent) + (indent > 0 ? '- ' : '# ');
    parts.push(`${prefix}${label}`);
    const children = node.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (typeof child === 'object' && child !== null) {
          traverse(child as Record<string, unknown>, indent + 1);
        }
      }
    }
  };
  traverse(root as Record<string, unknown>, 0);
}

function renderGuide(content: Record<string, unknown>, parts: string[]): void {
  const modules = content.modules;
  if (!Array.isArray(modules)) return;
  for (const mod of modules) {
    if (typeof mod !== 'object' || mod === null) continue;
    const d = mod as Record<string, unknown>;
    const title = jsonToText(d.title);
    if (title) parts.push(`## ${title}`);
    const objective = d.objective;
    if (typeof objective === 'object' && objective !== null) {
      const objText = jsonToText((objective as Record<string, unknown>).text);
      if (objText) parts.push(objText);
    }
    const keyPoints = d.key_points;
    if (Array.isArray(keyPoints) && keyPoints.length > 0) {
      parts.push('', '### 要点');
      for (const point of keyPoints) {
        const text =
          typeof point === 'object' && point !== null
            ? jsonToText((point as Record<string, unknown>).text)
            : jsonToText(point);
        if (text) parts.push(`- ${text}`);
      }
    }
    parts.push('');
  }
}

function renderBriefing(content: Record<string, unknown>, parts: string[]): void {
  const sections = content.sections;
  if (!Array.isArray(sections)) return;
  for (const section of sections) {
    if (typeof section !== 'object' || section === null) continue;
    const d = section as Record<string, unknown>;
    const heading = jsonToText(d.heading);
    if (heading) parts.push(`## ${heading}`);
    const points = d.points;
    if (Array.isArray(points)) {
      for (const point of points) {
        const text =
          typeof point === 'object' && point !== null
            ? jsonToText((point as Record<string, unknown>).text)
            : jsonToText(point);
        if (text) parts.push(`- ${text}`);
      }
    }
    parts.push('');
  }
}

function renderSlides(content: Record<string, unknown>, parts: string[]): void {
  const markdown = content.markdown;
  if (typeof markdown === 'string' && markdown.trim()) {
    parts.push(markdown);
    return;
  }
  const outline = content.outline;
  if (typeof outline !== 'object' || outline === null) return;
  const o = outline as Record<string, unknown>;
  if (!content.title) {
    const title = jsonToText(o.title) || '演示';
    parts.push(`# ${title}`);
  }
  const slides = o.slides;
  if (!Array.isArray(slides)) return;
  for (const slide of slides) {
    if (typeof slide !== 'object' || slide === null) continue;
    const d = slide as Record<string, unknown>;
    const slideTitle = jsonToText(d.title) || '幻灯片';
    parts.push(`## ${slideTitle}`);
    const bullets = d.bullets;
    if (Array.isArray(bullets)) {
      for (const bullet of bullets) parts.push(`- ${jsonToText(bullet)}`);
    }
  }
}

function renderStructured(content: Record<string, unknown>, parts: string[]): void {
  const bullets = content.bullets;
  if (Array.isArray(bullets)) {
    for (const bullet of bullets) {
      const text =
        typeof bullet === 'object' && bullet !== null
          ? jsonToText((bullet as Record<string, unknown>).text)
          : jsonToText(bullet);
      if (text) parts.push(`- ${text}`);
    }
  }
  const terms = content.terms;
  if (Array.isArray(terms) && terms.length > 0) {
    parts.push('', '## 术语');
    for (const term of terms) {
      const text = jsonToText(term);
      if (text) parts.push(`- ${text}`);
    }
  }
}

/**
 * Split text into chunks for embedding (v1 _split_text_to_chunks: 500/50).
 * Paragraph + sentence-aware splitting.
 */
export function splitTextToChunks(text: string, chunkSize = 500, overlap = 50): string[] {
  if (!text.trim()) return [];
  const paragraphs = text
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= chunkSize) {
      chunks.push(para);
    } else {
      const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > chunkSize && current.length > 0) {
          chunks.push(current.trim());
          current = current.slice(-overlap) + s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }
  return chunks;
}
