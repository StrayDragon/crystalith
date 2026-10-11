// Generation type registry — the typed-generation-framework SSOT (server side).
//
// Shared owns the vocabulary (GenerationTypeIdSchema) and contract shapes;
// this registry owns the descriptive metadata and defaults that request
// assembly, list serialization and result echoes all consume. Handlers MUST
// NOT hardcode per-type facts that belong here.
import type { GenerationTypeInfo, GenerationTypeId } from '@crystalith/shared';

/** Output types owned by the generic outputs pipeline (SLIDES is studio-only). */
export const OUTPUT_GENERATION_OUTPUT_TYPES = [
  'FAQ',
  'GUIDE',
  'TIMELINE',
  'MINDMAP',
  'QUIZ',
  'BRIEFING',
  'PARAGRAPH',
  'BULLETS',
  'STRUCTURED',
] as const;

/** Generation types that accept prompt presets (r188 preset binding). */
export const PRESET_CAPABLE_GENERATION_TYPES: readonly GenerationTypeId[] = ['qa'];

const REGISTRY: Record<GenerationTypeId, GenerationTypeInfo> = {
  qa: {
    id: 'qa',
    displayName: '知识问答',
    inputRequirement: 'question 必填；可选 sessionId / sourceIds / 检索参数',
    allowedOutputTypes: ['MESSAGE'],
    defaultOutputType: 'MESSAGE',
    completionSemantics: 'streamed-answer（一次性端点为完整 answer 字段）',
    allowedControls: ['lengthHint', 'requireCitations', 'preset', 'directive'],
  },
  output: {
    id: 'output',
    displayName: '结构化输出',
    inputRequirement: 'prompt 或手动 content（Studio 手记）；可选 sourceIds / chunkIds',
    allowedOutputTypes: [...OUTPUT_GENERATION_OUTPUT_TYPES],
    defaultOutputType: 'PARAGRAPH',
    completionSemantics: 'output-row（同步落库；手动 content 为 manual-note）',
    allowedControls: ['preference', 'topK', 'minScore'],
  },
  slides: {
    id: 'slides',
    displayName: '幻灯片',
    inputRequirement: 'prompt + 来源/大纲；由 studio 专属端点承接（无 generationTypeId 线上字段）',
    allowedOutputTypes: ['SLIDES'],
    defaultOutputType: 'SLIDES',
    completionSemantics: 'sse-done（done 事件携带 traceId 与 slideId）',
    allowedControls: [],
  },
};

/** Registry order is stable: qa → output → slides. */
export function listGenerationTypes(): GenerationTypeInfo[] {
  return Object.values(REGISTRY);
}

/** Defaults applied by request assembly (r467). */
export function defaultOutputType(id: GenerationTypeId): string {
  return REGISTRY[id].defaultOutputType;
}
