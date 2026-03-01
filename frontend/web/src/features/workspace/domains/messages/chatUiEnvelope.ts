export const CHAT_UI_ENVELOPE_MARKER = '[[crystalith-ui:v1]]';
export const CHAT_UI_ENVELOPE_DELIMITER = `\n\n${CHAT_UI_ENVELOPE_MARKER}\n`;

export type ChatUiEnvelopeSchema = 'crystalith.ui.message.v1';

export type ChatUiTextPart = {
  type: 'text';
  format: 'markdown';
  text: string;
};

export type ChatUiComponentPart = {
  type: 'component';
  name: string;
  id: string;
  props: Record<string, unknown>;
  streaming?: boolean;
};

export type ChatUiToolUsePart = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  auto_execute?: boolean;
  requires_confirm?: boolean;
};

export type ChatUiToolResultPart = {
  type: 'tool_result';
  tool_use_id: string;
  status: 'success' | 'error';
  output?: Record<string, unknown>;
  error_message?: string;
};

export type ChatUiPart =
  | ChatUiTextPart
  | ChatUiComponentPart
  | ChatUiToolUsePart
  | ChatUiToolResultPart;

export type ChatUiEnvelope = {
  schema: ChatUiEnvelopeSchema;
  parts: ChatUiPart[];
  meta?: Record<string, unknown>;
};

export type ParseChatUiEnvelopeResult = {
  fallbackText: string;
  envelope: ChatUiEnvelope | null;
};

const DEFAULT_LIMITS = {
  maxJsonBytes: 200_000,
  maxParts: 50,
  maxDepth: 20,
};

function exceedsMaxDepth(value: unknown, maxDepth: number): boolean {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 1 }];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const { value: current, depth } = next;
    if (depth > maxDepth) return true;
    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push({ value: item, depth: depth + 1 });
      }
      continue;
    }
    if (current && typeof current === 'object') {
      for (const item of Object.values(current as Record<string, unknown>)) {
        stack.push({ value: item, depth: depth + 1 });
      }
    }
  }
  return false;
}

function coerceParts(parts: unknown): ChatUiPart[] | null {
  if (!Array.isArray(parts)) return null;
  const items: ChatUiPart[] = [];
  for (const raw of parts) {
    if (!raw || typeof raw !== 'object') continue;
    const type = (raw as { type?: unknown }).type;
    if (type === 'text') {
      const format = (raw as { format?: unknown }).format;
      const text = (raw as { text?: unknown }).text;
      if (format !== 'markdown' || typeof text !== 'string') continue;
      items.push({ type: 'text', format: 'markdown', text });
      continue;
    }
    if (type === 'component') {
      const name = (raw as { name?: unknown }).name;
      const id = (raw as { id?: unknown }).id;
      const props = (raw as { props?: unknown }).props;
      const streaming = (raw as { streaming?: unknown }).streaming;
      if (typeof name !== 'string' || typeof id !== 'string') continue;
      if (!props || typeof props !== 'object' || Array.isArray(props)) continue;
      items.push({
        type: 'component',
        name,
        id,
        props: props as Record<string, unknown>,
        streaming: typeof streaming === 'boolean' ? streaming : undefined,
      });
      continue;
    }
    if (type === 'tool_use') {
      const id = (raw as { id?: unknown }).id;
      const name = (raw as { name?: unknown }).name;
      const input = (raw as { input?: unknown }).input;
      const autoExecute = (raw as { auto_execute?: unknown }).auto_execute;
      const requiresConfirm = (raw as { requires_confirm?: unknown }).requires_confirm;
      if (typeof id !== 'string' || typeof name !== 'string') continue;
      if (!input || typeof input !== 'object' || Array.isArray(input)) continue;
      items.push({
        type: 'tool_use',
        id,
        name,
        input: input as Record<string, unknown>,
        auto_execute: typeof autoExecute === 'boolean' ? autoExecute : undefined,
        requires_confirm: typeof requiresConfirm === 'boolean' ? requiresConfirm : undefined,
      });
      continue;
    }
    if (type === 'tool_result') {
      const toolUseId = (raw as { tool_use_id?: unknown }).tool_use_id;
      const status = (raw as { status?: unknown }).status;
      const output = (raw as { output?: unknown }).output;
      const errorMessage = (raw as { error_message?: unknown }).error_message;
      if (typeof toolUseId !== 'string') continue;
      if (status !== 'success' && status !== 'error') continue;
      const normalizedOutput =
        output && typeof output === 'object' && !Array.isArray(output)
          ? (output as Record<string, unknown>)
          : undefined;
      items.push({
        type: 'tool_result',
        tool_use_id: toolUseId,
        status,
        output: normalizedOutput,
        error_message: typeof errorMessage === 'string' ? errorMessage : undefined,
      });
    }
  }
  return items;
}

export function parseChatUiEnvelope(content: string): ParseChatUiEnvelopeResult {
  const delimiterIndex = content.indexOf(CHAT_UI_ENVELOPE_DELIMITER);
  if (delimiterIndex < 0) {
    return { fallbackText: content, envelope: null };
  }

  const fallbackText = content.slice(0, delimiterIndex);
  const jsonText = content.slice(delimiterIndex + CHAT_UI_ENVELOPE_DELIMITER.length);
  if (!jsonText.trim()) {
    return { fallbackText, envelope: null };
  }

  const jsonBytes = new TextEncoder().encode(jsonText).length;
  if (jsonBytes > DEFAULT_LIMITS.maxJsonBytes) {
    return { fallbackText, envelope: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { fallbackText, envelope: null };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { fallbackText, envelope: null };
  }
  if (exceedsMaxDepth(parsed, DEFAULT_LIMITS.maxDepth)) {
    return { fallbackText, envelope: null };
  }

  const schema = (parsed as { schema?: unknown }).schema;
  if (schema !== 'crystalith.ui.message.v1') {
    return { fallbackText, envelope: null };
  }
  const parts = coerceParts((parsed as { parts?: unknown }).parts);
  if (!parts || parts.length > DEFAULT_LIMITS.maxParts) {
    return { fallbackText, envelope: null };
  }
  const metaRaw = (parsed as { meta?: unknown }).meta;
  const meta =
    metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
      ? (metaRaw as Record<string, unknown>)
      : undefined;
  return {
    fallbackText,
    envelope: {
      schema,
      parts,
      meta,
    },
  };
}

