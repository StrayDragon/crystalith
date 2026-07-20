// Output type-aware text rendering — ports v1 `_extract_text_from_output`
// (api.py:515-693).
//
// Each output type (FAQ/TIMELINE/MINDMAP/QUIZ/etc.) is rendered into readable
// markdown. Used by:
//  - export endpoint (format=markdown)
//  - convert-to-source (type-aware chunking instead of raw JSON)

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Coerce a JSON value to text (v1 _json_to_text). */
function jsonToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return asString(value);
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
  type: string,
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
      typeof item === 'string' ? item : jsonToText(isRecord(item) ? item.text : undefined);
    if (text) parts.push(`- ${text}`);
  }
}

function renderFaq(content: Record<string, unknown>, parts: string[]): void {
  const items = content.items;
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!isRecord(item)) continue;
    const q = jsonToText(item.question);
    const a = jsonToText(item.answer);
    if (q) parts.push(`**Q: ${q}**`);
    if (a) parts.push(`A: ${a}`);
    parts.push('');
  }
}

function renderTimeline(content: Record<string, unknown>, parts: string[]): void {
  const events = content.events;
  if (!Array.isArray(events)) return;
  for (const event of events) {
    if (!isRecord(event)) continue;
    const date = jsonToText(event.date);
    const title = jsonToText(event.event);
    const desc = jsonToText(event.description);
    parts.push(`**${date}** - ${title}`);
    if (desc) parts.push(`  ${desc}`);
  }
}

function renderQuiz(content: Record<string, unknown>, parts: string[]): void {
  const questions = content.questions;
  if (!Array.isArray(questions)) return;
  questions.forEach((q, i) => {
    if (!isRecord(q)) return;
    const question = jsonToText(q.question);
    parts.push(`${i + 1}. ${question}`);
    const options = q.options;
    if (Array.isArray(options)) {
      for (const opt of options) parts.push(`   - ${jsonToText(opt)}`);
    }
    const answer = jsonToText(q.answer);
    if (answer) parts.push(`   答案: ${answer}`);
    parts.push('');
  });
}

function renderMindmap(content: Record<string, unknown>, parts: string[]): void {
  const root = content.root;
  if (!isRecord(root)) return;
  const traverse = (node: Record<string, unknown>, indent: number) => {
    const label = jsonToText(node.label);
    const prefix = '  '.repeat(indent) + (indent > 0 ? '- ' : '# ');
    parts.push(`${prefix}${label}`);
    const children = node.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (isRecord(child)) {
          traverse(child, indent + 1);
        }
      }
    }
  };
  traverse(root, 0);
}

function renderGuide(content: Record<string, unknown>, parts: string[]): void {
  const modules = content.modules;
  if (!Array.isArray(modules)) return;
  for (const mod of modules) {
    if (!isRecord(mod)) continue;
    const title = jsonToText(mod.title);
    if (title) parts.push(`## ${title}`);
    const objective = mod.objective;
    if (isRecord(objective)) {
      const objText = jsonToText(objective.text);
      if (objText) parts.push(objText);
    }
    const keyPoints = Array.isArray(mod.keyPoints) ? mod.keyPoints : null;
    if (Array.isArray(keyPoints) && keyPoints.length > 0) {
      parts.push('', '### 要点');
      for (const point of keyPoints) {
        const text = isRecord(point) ? jsonToText(point.text) : jsonToText(point);
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
    if (!isRecord(section)) continue;
    const heading = jsonToText(section.heading);
    if (heading) parts.push(`## ${heading}`);
    const points = section.points;
    if (Array.isArray(points)) {
      for (const point of points) {
        const text = isRecord(point) ? jsonToText(point.text) : jsonToText(point);
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
  if (!isRecord(outline)) return;
  if (!content.title) {
    const title = jsonToText(outline.title) || '演示';
    parts.push(`# ${title}`);
  }
  const slides = outline.slides;
  if (!Array.isArray(slides)) return;
  for (const slide of slides) {
    if (!isRecord(slide)) continue;
    const slideTitle = jsonToText(slide.title) || '幻灯片';
    parts.push(`## ${slideTitle}`);
    const bullets = slide.bullets;
    if (Array.isArray(bullets)) {
      for (const bullet of bullets) parts.push(`- ${jsonToText(bullet)}`);
    }
  }
}

function renderStructured(content: Record<string, unknown>, parts: string[]): void {
  const bullets = content.bullets;
  if (Array.isArray(bullets)) {
    for (const bullet of bullets) {
      const text = isRecord(bullet) ? jsonToText(bullet.text) : jsonToText(bullet);
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
      const sentences = para.match(/[^.!?]+[.!?]+/gu) ?? [para];
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
