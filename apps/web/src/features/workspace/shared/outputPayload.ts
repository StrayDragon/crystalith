import type {
  OutputContentByType,
  OutputItem,
  OutputPayload,
  OutputTypeId,
  TypedOutputItem,
  UnknownOutputPayload,
  KnownOutputPayload,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function toUnknownOutputPayload(content: unknown, warning: string): UnknownOutputPayload {
  const base: Record<string, unknown> = isRecord(content) ? { ...content } : { raw: content };
  const rawWarnings = base._warnings;
  const existingWarnings = Array.isArray(rawWarnings)
    ? rawWarnings.filter((item: unknown): item is string => typeof item === 'string')
    : [];
  const warnings = existingWarnings.includes(warning)
    ? existingWarnings
    : [...existingWarnings, warning];
  return {
    ...base,
    _fallback: true,
    _warnings: warnings,
  };
}

function isFaqContent(content: unknown): content is OutputContentByType['FAQ'] {
  return isRecord(content) && Array.isArray(content.items);
}

function isGuideContent(content: unknown): content is OutputContentByType['GUIDE'] {
  return isRecord(content) && Array.isArray(content.modules);
}

function isTimelineContent(content: unknown): content is OutputContentByType['TIMELINE'] {
  return isRecord(content) && Array.isArray(content.events);
}

function isMindmapContent(content: unknown): content is OutputContentByType['MINDMAP'] {
  return isRecord(content) && isRecord(content.root);
}

function isQuizContent(content: unknown): content is OutputContentByType['QUIZ'] {
  return isRecord(content) && Array.isArray(content.questions);
}

function isBriefingContent(content: unknown): content is OutputContentByType['BRIEFING'] {
  return isRecord(content) && Array.isArray(content.sections);
}

function isSlidesContent(content: unknown): content is OutputContentByType['SLIDES'] {
  if (!isRecord(content)) return false;
  if (typeof content.title === 'string') return true;
  if (typeof content.markdown === 'string') return true;
  if (typeof content.slideId === 'number' || content.slideId === null) return true;
  if (isRecord(content.outline)) return true;
  return false;
}

function isParagraphContent(content: unknown): content is OutputContentByType['PARAGRAPH'] {
  return isRecord(content) && typeof content.text === 'string';
}

function isBulletsContent(content: unknown): content is OutputContentByType['BULLETS'] {
  return isRecord(content) && Array.isArray(content.items);
}

function isStructuredContent(content: unknown): content is OutputContentByType['STRUCTURED'] {
  if (!isRecord(content)) return false;
  if (typeof content.title === 'string') return true;
  if (Array.isArray(content.bullets)) return true;
  if (isStringArray(content.terms)) return true;
  return false;
}

export function decodeOutputContent(
  type: 'FAQ',
  content: unknown,
): OutputContentByType['FAQ'] | null;
export function decodeOutputContent(
  type: 'GUIDE',
  content: unknown,
): OutputContentByType['GUIDE'] | null;
export function decodeOutputContent(
  type: 'TIMELINE',
  content: unknown,
): OutputContentByType['TIMELINE'] | null;
export function decodeOutputContent(
  type: 'MINDMAP',
  content: unknown,
): OutputContentByType['MINDMAP'] | null;
export function decodeOutputContent(
  type: 'QUIZ',
  content: unknown,
): OutputContentByType['QUIZ'] | null;
export function decodeOutputContent(
  type: 'BRIEFING',
  content: unknown,
): OutputContentByType['BRIEFING'] | null;
export function decodeOutputContent(
  type: 'SLIDES',
  content: unknown,
): OutputContentByType['SLIDES'] | null;
export function decodeOutputContent(
  type: 'PARAGRAPH',
  content: unknown,
): OutputContentByType['PARAGRAPH'] | null;
export function decodeOutputContent(
  type: 'BULLETS',
  content: unknown,
): OutputContentByType['BULLETS'] | null;
export function decodeOutputContent(
  type: 'STRUCTURED',
  content: unknown,
): OutputContentByType['STRUCTURED'] | null;
export function decodeOutputContent(
  type: OutputTypeId,
  content: unknown,
): KnownOutputPayload | null;
export function decodeOutputContent(
  type: OutputTypeId,
  content: unknown,
): KnownOutputPayload | null {
  switch (type) {
    case 'FAQ':
      return isFaqContent(content) ? content : null;
    case 'GUIDE':
      return isGuideContent(content) ? content : null;
    case 'TIMELINE':
      return isTimelineContent(content) ? content : null;
    case 'MINDMAP':
      return isMindmapContent(content) ? content : null;
    case 'QUIZ':
      return isQuizContent(content) ? content : null;
    case 'BRIEFING':
      return isBriefingContent(content) ? content : null;
    case 'SLIDES':
      return isSlidesContent(content) ? content : null;
    case 'PARAGRAPH':
      return isParagraphContent(content) ? content : null;
    case 'BULLETS':
      return isBulletsContent(content) ? content : null;
    case 'STRUCTURED':
      return isStructuredContent(content) ? content : null;
    default:
      return null;
  }
}

export function isOutputContentForType<K extends OutputTypeId>(
  type: K,
  content: unknown,
): content is OutputContentByType[K] {
  switch (type) {
    case 'FAQ':
      return isFaqContent(content);
    case 'GUIDE':
      return isGuideContent(content);
    case 'TIMELINE':
      return isTimelineContent(content);
    case 'MINDMAP':
      return isMindmapContent(content);
    case 'QUIZ':
      return isQuizContent(content);
    case 'BRIEFING':
      return isBriefingContent(content);
    case 'SLIDES':
      return isSlidesContent(content);
    case 'PARAGRAPH':
      return isParagraphContent(content);
    case 'BULLETS':
      return isBulletsContent(content);
    case 'STRUCTURED':
      return isStructuredContent(content);
    default:
      return false;
  }
}

export function decodeOutputItem(output: OutputItem): TypedOutputItem | null {
  if (!output.content) return null;
  switch (output.type) {
    case 'FAQ': {
      if (!isFaqContent(output.content)) return null;
      return { ...output, type: 'FAQ', content: output.content };
    }
    case 'GUIDE': {
      if (!isGuideContent(output.content)) return null;
      return { ...output, type: 'GUIDE', content: output.content };
    }
    case 'TIMELINE': {
      if (!isTimelineContent(output.content)) return null;
      return { ...output, type: 'TIMELINE', content: output.content };
    }
    case 'MINDMAP': {
      if (!isMindmapContent(output.content)) return null;
      return { ...output, type: 'MINDMAP', content: output.content };
    }
    case 'QUIZ': {
      if (!isQuizContent(output.content)) return null;
      return { ...output, type: 'QUIZ', content: output.content };
    }
    case 'BRIEFING': {
      if (!isBriefingContent(output.content)) return null;
      return { ...output, type: 'BRIEFING', content: output.content };
    }
    case 'SLIDES': {
      if (!isSlidesContent(output.content)) return null;
      return { ...output, type: 'SLIDES', content: output.content };
    }
    case 'PARAGRAPH': {
      if (!isParagraphContent(output.content)) return null;
      return { ...output, type: 'PARAGRAPH', content: output.content };
    }
    case 'BULLETS': {
      if (!isBulletsContent(output.content)) return null;
      return { ...output, type: 'BULLETS', content: output.content };
    }
    case 'STRUCTURED': {
      if (!isStructuredContent(output.content)) return null;
      return { ...output, type: 'STRUCTURED', content: output.content };
    }
    default:
      return null;
  }
}

export function normalizeOutputPayload(type: OutputTypeId, content: unknown): OutputPayload {
  const decoded = decodeOutputContent(type, content);
  if (decoded) return decoded;
  return toUnknownOutputPayload(content, `Invalid payload for ${type}`);
}

export function isFallbackOutputPayload(content: OutputPayload): boolean {
  return Boolean(isRecord(content) && content._fallback === true);
}

export function getOutputPayloadWarnings(content: OutputPayload): string[] {
  if (!isRecord(content)) return [];
  if (!Array.isArray(content._warnings)) return [];
  return content._warnings.filter((item): item is string => typeof item === 'string');
}

export function getOutputTitle(
  output: Pick<OutputItem, 'type' | 'content' | 'prompt'> & { title?: string | null },
): string {
  if (typeof output.title === 'string') {
    const listed = output.title.trim();
    if (listed) return listed;
  }
  if (isRecord(output.content) && typeof output.content.title === 'string') {
    const title = output.content.title.trim();
    if (title) return title;
  }
  const prompt = output.prompt?.trim();
  if (prompt) return prompt;
  return `${output.type} 输出`;
}

export function getSlideIdFromOutput(output: OutputItem): number | null {
  if (output.type !== 'SLIDES') return null;
  if (typeof output.slideId === 'number') return output.slideId;
  if (!output.content) return null;
  const slides = decodeOutputContent('SLIDES', output.content);
  if (!slides) return null;
  const slideId = slides.slideId;
  return typeof slideId === 'number' ? slideId : null;
}

export function pickTextValue(value: string | { text?: string | null } | null | undefined): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return typeof value.text === 'string' ? value.text : '';
}
