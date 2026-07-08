// Message schemas — `crystalith.features.messages.schemas`
import { z } from 'zod';

import { CitationSchema, IdSchema, IsoTimestampSchema } from './common.js';

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  session_id: IdSchema,
  role: MessageRoleSchema,
  content: z.string().min(1),
  citations: z.array(CitationSchema).nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Message = z.infer<typeof MessageSchema>;

export const MessageCreateSchema = z.object({
  role: MessageRoleSchema,
  content: z.string().min(1),
  citations: z.array(CitationSchema).nullable().optional(),
});
export type MessageCreate = z.infer<typeof MessageCreateSchema>;

export const MessageListSchema = z.object({
  messages: z.array(MessageSchema),
});

/** Single chat turn used when building LLM conversation history. */
export const ChatTurnSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;
