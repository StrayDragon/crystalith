// Analysis schemas — topic modeling + relation/contradiction graph.
// Mirrors v1 `features.analysis.types`.
import { z } from "zod";
import { IdSchema, JsonMetadataSchema } from "./common.js";

export const RelationTypeSchema = z.enum(["similar", "references", "contradicts"]);
export type RelationType = z.infer<typeof RelationTypeSchema>;

export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  chunk_ids: z.array(IdSchema),
  keywords: z.array(z.string()),
});
export type Topic = z.infer<typeof TopicSchema>;

export const RelationSchema = z.object({
  source_chunk_id: IdSchema,
  target_chunk_id: IdSchema,
  relation_type: RelationTypeSchema,
  score: z.number(),
});
export type Relation = z.infer<typeof RelationSchema>;

export const AnalysisResultSchema = z.object({
  topics: z.array(TopicSchema),
  relations: z.array(RelationSchema),
  contradictions: z.array(RelationSchema),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const AnalysisRequestSchema = z.object({
  notebook_id: IdSchema,
  options: JsonMetadataSchema.optional(),
});
