import type {
  OutputContentByType,
  OutputItem,
  OutputPayload,
  OutputTypeId,
  TypedOutputItem,
  UnknownOutputPayload,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function toUnknownOutputPayload(content: unknown, warning: string): UnknownOutputPayload {
  const base: Record<string, unknown> = isRecord(content) ? { ...content } : { raw: content };
  const rawWarnings = base._warnings;
  const existingWarnings = Array.isArray(rawWarnings)
    ? rawWarnings.filter((item: unknown): item is string => typeof item === "string")
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

function isFaqContent(content: unknown): content is OutputContentByType["FAQ"] {
  return isRecord(content) && Array.isArray(content.items);
}

function isGuideContent(content: unknown): content is OutputContentByType["GUIDE"] {
  return isRecord(content) && Array.isArray(content.modules);
}

function isTimelineContent(content: unknown): content is OutputContentByType["TIMELINE"] {
  return isRecord(content) && Array.isArray(content.events);
}

function isMindmapContent(content: unknown): content is OutputContentByType["MINDMAP"] {
  return isRecord(content) && isRecord(content.root);
}

function isQuizContent(content: unknown): content is OutputContentByType["QUIZ"] {
  return isRecord(content) && Array.isArray(content.questions);
}

function isBriefingContent(content: unknown): content is OutputContentByType["BRIEFING"] {
  return isRecord(content) && Array.isArray(content.sections);
}

function isSlidesContent(content: unknown): content is OutputContentByType["SLIDES"] {
  if (!isRecord(content)) return false;
  if (typeof content.title === "string") return true;
  if (typeof content.markdown === "string") return true;
  if (typeof content.slide_id === "number" || content.slide_id === null) return true;
  if (isRecord(content.outline)) return true;
  return false;
}

function isParagraphContent(content: unknown): content is OutputContentByType["PARAGRAPH"] {
  return isRecord(content) && typeof content.text === "string";
}

function isBulletsContent(content: unknown): content is OutputContentByType["BULLETS"] {
  return isRecord(content) && Array.isArray(content.items);
}

function isStructuredContent(content: unknown): content is OutputContentByType["STRUCTURED"] {
  if (!isRecord(content)) return false;
  if (typeof content.title === "string") return true;
  if (Array.isArray(content.bullets)) return true;
  if (isStringArray(content.terms)) return true;
  return false;
}

export function decodeOutputContent<K extends OutputTypeId>(
  type: K,
  content: unknown,
): OutputContentByType[K] | null {
  switch (type) {
    case "FAQ":
      return (isFaqContent(content) ? content : null) as OutputContentByType[K] | null;
    case "GUIDE":
      return (isGuideContent(content) ? content : null) as OutputContentByType[K] | null;
    case "TIMELINE":
      return (isTimelineContent(content) ? content : null) as OutputContentByType[K] | null;
    case "MINDMAP":
      return (isMindmapContent(content) ? content : null) as OutputContentByType[K] | null;
    case "QUIZ":
      return (isQuizContent(content) ? content : null) as OutputContentByType[K] | null;
    case "BRIEFING":
      return (isBriefingContent(content) ? content : null) as OutputContentByType[K] | null;
    case "SLIDES":
      return (isSlidesContent(content) ? content : null) as OutputContentByType[K] | null;
    case "PARAGRAPH":
      return (isParagraphContent(content) ? content : null) as OutputContentByType[K] | null;
    case "BULLETS":
      return (isBulletsContent(content) ? content : null) as OutputContentByType[K] | null;
    case "STRUCTURED":
      return (isStructuredContent(content) ? content : null) as OutputContentByType[K] | null;
    default:
      return null;
  }
}

export function isOutputContentForType<K extends OutputTypeId>(
  type: K,
  content: unknown,
): content is OutputContentByType[K] {
  return decodeOutputContent(type, content) !== null;
}

export function decodeOutputItem(output: OutputItem): TypedOutputItem | null {
  const decoded = decodeOutputContent(output.type, output.content);
  if (!decoded) return null;
  return {
    ...output,
    content: decoded,
  } as TypedOutputItem;
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
  return content._warnings.filter((item): item is string => typeof item === "string");
}

export function getOutputTitle(output: Pick<OutputItem, "type" | "content" | "prompt">): string {
  if (isRecord(output.content) && typeof output.content.title === "string") {
    const title = output.content.title.trim();
    if (title) return title;
  }
  const prompt = output.prompt?.trim();
  if (prompt) return prompt;
  return `${output.type} 输出`;
}

export function getSlideIdFromOutput(output: OutputItem): number | null {
  if (output.type !== "SLIDES") return null;
  const slides = decodeOutputContent("SLIDES", output.content);
  if (!slides) return null;
  return typeof slides.slide_id === "number" ? slides.slide_id : null;
}

export function pickTextValue(value: string | { text?: string | null } | null | undefined): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return typeof value.text === "string" ? value.text : "";
}
