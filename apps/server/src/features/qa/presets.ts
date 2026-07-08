// QA presets — system prompt templates for different conversation modes.
//
// Replaces v1 `features/qa/presets.py` with a typed TS record.
// Each preset has a name (used in UI) and a system prompt template.
// Special directives like `@(Sources_only)` are parsed at runtime before
// injection.
export interface QAPreset {
  name: string;
  /** Short label for the UI dropdown. */
  label: string;
  /** System prompt template. Supports `{{directive}}` placeholder. */
  systemPrompt: string;
}

/** Directive tokens that are replaced at runtime with dynamic context. */
export type Directive = 'Sources_only' | 'Knowledge_only' | 'Mixed';

/** Preset registry (add new presets here). */
export const PRESETS: Record<string, QAPreset> = {
  default: {
    name: 'default',
    label: '精确问答',
    systemPrompt: `You are a helpful RAG assistant. Answer the user's question based on the provided context.

Rules:
1. Base your answer on the retrieved sources — cite them using [Source: N] notation.
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
};

/** Directive templates — injected at `{{directive}}` depending on user selection. */
export const DIRECTIVES: Record<Directive, string> = {
  Sources_only:
    'CRITICAL: Only use information from the retrieved sources. Do NOT use external knowledge.',
  Knowledge_only: 'Use your knowledge freely. Only consult sources if explicitly needed.',
  Mixed: 'Use both retrieved sources and your own knowledge. Prioritize high-quality sources.',
};

/**
 * Render a preset's system prompt with the selected directive.
 */
export function resolvePreset(presetName: string, directive: Directive = 'Mixed'): string {
  const preset = PRESETS[presetName] ?? PRESETS.default;
  const directiveText = DIRECTIVES[directive];
  return preset.systemPrompt.replace('{{directive}}', directiveText ? `\n${directiveText}` : '');
}

/** List available preset names for UI. */
export function listPresets(): { name: string; label: string }[] {
  return Object.values(PRESETS).map(({ name, label }) => ({ name, label }));
}
