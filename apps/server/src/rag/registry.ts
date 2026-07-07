// RAG Registry — pluggable strategy registration + per-notebook configuration.
//
// Strategies register themselves at module load. Each notebook can enable
// multiple strategies; the active set is persisted in the `strategy_configs`
// DB table.
import { eq } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { db } from '../db/index.ts';
import type { RAGStrategy } from './types.ts';

// ---------------------------------------------------------------------------
// DB schema for strategy configuration (added during Drizzle migration)
// ---------------------------------------------------------------------------

export const strategyConfigs = sqliteTable('strategy_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  notebookId: integer('notebook_id').notNull(),
  strategyId: text('strategy_id').notNull(),
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class RAGRegistry {
  private strategies = new Map<string, RAGStrategy>();

  /** Register a strategy implementation. */
  register(strategy: RAGStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  /** Get a strategy by ID. Throws if not found. */
  get(id: string): RAGStrategy {
    const s = this.strategies.get(id);
    if (!s) throw new Error(`RAG strategy "${id}" not registered`);
    return s;
  }

  /** List all registered strategy IDs. */
  list(): string[] {
    return Array.from(this.strategies.keys());
  }

  /** List all registered with full details. */
  listAll(): { id: string; name: string; version: string }[] {
    return Array.from(this.strategies.values()).map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version,
    }));
  }

  /** Get strategies enabled for a notebook (persisted in DB). */
  getForNotebook(notebookId: number): string[] {
    return db()
      .select({ strategyId: strategyConfigs.strategyId })
      .from(strategyConfigs)
      .where(eq(strategyConfigs.notebookId, notebookId))
      .all()
      .map((r) => r.strategyId);
  }

  /** Set the enabled strategies for a notebook (replaces existing). */
  setForNotebook(notebookId: number, strategyIds: string[]): void {
    // Validate all strategy IDs exist
    for (const id of strategyIds) {
      if (!this.strategies.has(id)) {
        throw new Error(`RAG strategy "${id}" not registered`);
      }
    }

    // Replace existing configs for this notebook
    db().delete(strategyConfigs).where(eq(strategyConfigs.notebookId, notebookId)).run();

    for (const sid of strategyIds) {
      db().insert(strategyConfigs).values({ notebookId, strategyId: sid }).run();
    }
  }

  /**
   * Apply active strategies: index all enabled sources in the notebook.
   */
  async indexNotebook(notebookId: number, sourceIds: number[]): Promise<void> {
    const activeIds = this.getForNotebook(notebookId);
    // Default to embed if nothing configured
    const ids = activeIds.length > 0 ? activeIds : ['embed'];

    for (const sid of ids) {
      const strategy = this.get(sid);
      for (const sourceId of sourceIds) {
        await strategy.indexSource(sourceId, notebookId);
      }
    }
  }

  /**
   * Retrieve chunks using the first active strategy for a notebook.
   * For hybrid/fusion, use retrieveAll() instead.
   */
  async retrieve(notebookId: number, query: string, opts?: { topK?: number; minScore?: number }) {
    const activeIds = this.getForNotebook(notebookId);
    const ids = activeIds.length > 0 ? activeIds : ['embed'];
    const strategy = this.get(ids[0]);
    return strategy.retrieve(query, notebookId, opts);
  }

  /**
   * Retrieve using a specific named strategy.
   */
  async retrieveWith(
    strategyId: string,
    notebookId: number,
    query: string,
    opts?: { topK?: number; minScore?: number },
  ) {
    const strategy = this.get(strategyId);
    return strategy.retrieve(query, notebookId, opts);
  }

  /** Check if any active strategy has indexed a notebook. */
  async isNotebookIndexed(notebookId: number): Promise<boolean> {
    const activeIds = this.getForNotebook(notebookId);
    const ids = activeIds.length > 0 ? activeIds : ['embed'];

    for (const sid of ids) {
      const strategy = this.get(sid);
      if (await strategy.isIndexed(notebookId)) return true;
    }
    return false;
  }
}

/** Global singleton registry. */
export const ragRegistry = new RAGRegistry();
