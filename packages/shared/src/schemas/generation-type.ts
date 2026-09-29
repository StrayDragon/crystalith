// @crystalith/shared — generation type contract schemas (typed-generation-framework).
//
// SSOT split: this module owns the wire vocabulary and contract SHAPES that
// web + server both consume; the descriptive registry (display names, input
// requirements, defaults, completion semantics) lives server-side in
// apps/server/src/features/generation-types/registry.ts.
import { z } from 'zod';

import './zod-extend.js';
import { desc } from './i18n.js';

/** Generation type ids — the first-class typed-generation vocabulary. */
export const GenerationTypeIdSchema = z.enum(['qa', 'output', 'slides']);
export type GenerationTypeId = z.infer<typeof GenerationTypeIdSchema>;

/** Structured generation constraint overrides for the QA surface (r186). */
export const QaControlsSchema = z
  .object({
    lengthHint: z.enum(['concise', 'balanced', 'comprehensive']).optional(),
    requireCitations: z.boolean().optional(),
  })
  .openapi({ description: desc('generation.qa_controls', 'QA 生成约束覆盖（结构化控制项）') });
export type QaControls = z.infer<typeof QaControlsSchema>;

/** Per-generation-type contract descriptor — the list endpoint payload (r466/r323). */
export const GenerationTypeInfoSchema = z
  .object({
    id: GenerationTypeIdSchema,
    displayName: z.string(),
    inputRequirement: z.string(),
    allowedOutputTypes: z.array(z.string()),
    defaultOutputType: z.string(),
    completionSemantics: z.string(),
    allowedControls: z.array(z.string()),
  })
  .openapi({ description: desc('generation.type_info', '生成类型合约（一等对象）') });
export type GenerationTypeInfo = z.infer<typeof GenerationTypeInfoSchema>;

/** GET /v2/generation-types response. */
export const GenerationTypesListResponseSchema = z
  .object({
    types: z.array(GenerationTypeInfoSchema),
  })
  .openapi({ description: desc('generation.types_list', '可用生成类型列表') });
export type GenerationTypesListResponse = z.infer<typeof GenerationTypesListResponseSchema>;

/** Effective-generation metadata echoed with generation results (r189/r326). */
export const GenerationMetaSchema = z
  .object({
    generationTypeId: GenerationTypeIdSchema,
    outputType: z.string(),
    completion: z.string(),
    presetId: z.string().nullable().optional(),
    effectiveControls: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .openapi({
    description: desc(
      'generation.meta',
      '生成结果回传的生效生成元数据（类型/输出类型/完成语义/控制项）',
    ),
  });
export type GenerationMeta = z.infer<typeof GenerationMetaSchema>;
