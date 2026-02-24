import type { OutputItem, OutputTypeId } from '../../shared/types';
import { decodeOutputContent, decodeOutputItem, getOutputTitle } from '../../shared/outputPayload';
import { formatStructuredOutputForCopy } from '../../shared/utils';

export type ExportFormat = 'markdown' | 'json' | 'pdf' | 'pptx';

interface SlideExportItem {
  title: string;
  bullets: string[];
  paragraphs: string[];
}

const DEFAULT_EXPORT_FORMATS: ExportFormat[] = ['markdown'];

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  markdown: 'Markdown',
  json: 'JSON',
  pdf: 'PDF',
  pptx: 'PPTX',
};

export const OUTPUT_EXPORT_FORMATS: Record<OutputTypeId, ExportFormat[]> = {
  FAQ: ['markdown', 'json'],
  GUIDE: ['markdown'],
  TIMELINE: ['markdown'],
  MINDMAP: ['markdown'],
  QUIZ: ['markdown', 'json'],
  BRIEFING: ['markdown', 'pdf'],
  SLIDES: ['markdown', 'pptx'],
  PARAGRAPH: ['markdown'],
  BULLETS: ['markdown'],
  STRUCTURED: ['markdown'],
};

function resolveOutputTitle(output: OutputItem): string {
  return getOutputTitle(output);
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');

  return sanitized || 'output';
}

export function getSupportedExportFormats(type: OutputTypeId): ExportFormat[] {
  return OUTPUT_EXPORT_FORMATS[type] ?? DEFAULT_EXPORT_FORMATS;
}

export function buildMarkdownExport(output: OutputItem): string {
  const title = resolveOutputTitle(output);
  const body = formatStructuredOutputForCopy(output).trim();

  return [
    `# ${title}`,
    '',
    `- 输出类型: ${output.type}`,
    `- 导出时间: ${new Date().toISOString()}`,
    '',
    body || '（空内容）',
    '',
  ].join('\n');
}

export function buildJsonExport(output: OutputItem): Record<string, unknown> {
  const typed = decodeOutputItem(output);

  if (typed?.type === 'FAQ') {
    return {
      schema: 'crystalith.flashcards.v1',
      type: 'flashcard',
      title: resolveOutputTitle(output),
      items: typed.content.items.map((item, index) => ({
        id: index + 1,
        front: item.question ?? '',
        back: item.answer ?? '',
      })),
    };
  }

  if (typed?.type === 'QUIZ') {
    return {
      schema: 'crystalith.quiz.v1',
      type: 'quiz',
      title: resolveOutputTitle(output),
      questions: typed.content.questions.map((question, index) => ({
        id: index + 1,
        question: question.question ?? '',
        options: Array.isArray(question.options) ? question.options : [],
        answer: question.answer ?? '',
        explanation: question.explanation ?? '',
      })),
    };
  }

  return {
    schema: 'crystalith.output.v1',
    type: output.type,
    title: resolveOutputTitle(output),
    content: output.content ?? {},
  };
}

function parseSlidesFromMarkdown(markdown: string): SlideExportItem[] {
  const lines = markdown.split('\n');
  const slides: SlideExportItem[] = [];
  let current: SlideExportItem | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('# ')) {
      if (current) {
        slides.push(current);
      }
      current = {
        title: line.replace(/^#\s+/, ''),
        bullets: [],
        paragraphs: [],
      };
      continue;
    }

    if (line.startsWith('## ')) {
      if (current) {
        slides.push(current);
      }
      current = {
        title: line.replace(/^##\s+/, ''),
        bullets: [],
        paragraphs: [],
      };
      continue;
    }

    if (!current) {
      current = {
        title: '导出幻灯片',
        bullets: [],
        paragraphs: [],
      };
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      current.bullets.push(line.replace(/^[-*]\s+/, ''));
    } else {
      current.paragraphs.push(line);
    }
  }

  if (current) {
    slides.push(current);
  }

  return slides;
}

export function buildSlidesExportItems(output: OutputItem): SlideExportItem[] {
  const slidesContent = decodeOutputContent('SLIDES', output.content);
  const outlineSlides = slidesContent?.outline?.slides;

  if (Array.isArray(outlineSlides) && outlineSlides.length > 0) {
    return outlineSlides.map((slide) => ({
      title: slide.title || '未命名幻灯片',
      bullets: Array.isArray(slide.bullets) ? slide.bullets.map((item) => String(item)) : [],
      paragraphs: [],
    }));
  }

  const markdown = typeof slidesContent?.markdown === 'string' ? slidesContent.markdown : '';
  const parsed = markdown ? parseSlidesFromMarkdown(markdown) : [];
  if (parsed.length > 0) return parsed;

  return [
    {
      title: resolveOutputTitle(output),
      bullets: [],
      paragraphs: [formatStructuredOutputForCopy(output).slice(0, 3000)],
    },
  ];
}

export function buildExportFileName(output: OutputItem, format: ExportFormat): string {
  const extension = format === 'markdown' ? 'md' : format;
  const title = sanitizeFileName(resolveOutputTitle(output));
  return `${title}.${extension}`;
}
