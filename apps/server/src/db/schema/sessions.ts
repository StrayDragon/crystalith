// Sessions + Messages domain.
import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ts, tsUpd } from './columns.ts';
import { jsonReq } from './columns.ts';
import { notebooks } from './notebooks.ts';

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notebookId: integer('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    title: text('title'),
    sharedState: jsonReq('shared_state').default(sql`'{}'`),
    sharedStateRevision: integer('shared_state_revision').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_sessions_notebook_id_updated_at').on(t.notebookId, t.updatedAt)],
);

export const sessionRelations = relations(sessions, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sessions.notebookId], references: [notebooks.id] }),
  messages: many(messages),
}));

export const messages = sqliteTable(
  'messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    citations: text('citations', { mode: 'json' }).$type<unknown[] | null>(),
    createdAt: ts('created_at'),
    updatedAt: tsUpd('updated_at'),
  },
  (t) => [index('ix_messages_session_id_created_at').on(t.sessionId, t.createdAt)],
);

export const messageRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
}));
