// Message schemas — `crystalith.features.messages.schemas`
import { z } from 'zod';

import { CitationSchema, IdSchema, IsoTimestampSchema } from './common.js';
import { desc } from './i18n.js';

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: IdSchema.describe(desc('message.id')),
  sessionId: IdSchema.describe(desc('message.session_id')),
  role: MessageRoleSchema.describe(desc('message.role')),
  content: z.string().min(1).describe(desc('message.content')),
  citations: z.array(CitationSchema).nullable().optional(),
  createdAt: IsoTimestampSchema.describe(desc('message.created_at')),
  updatedAt: IsoTimestampSchema,
});
export type Message = z.infer<typeof MessageSchema>;

export const MessageCreateSchema = z.object({
  role: MessageRoleSchema.describe(desc('message.role')),
  content: z.string().min(1).describe(desc('message.content')),
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
