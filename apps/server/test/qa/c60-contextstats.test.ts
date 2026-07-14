// c60 tests — ContextStats system_tokens real counting + max_tokens from config.
import { describe, expect, it } from 'bun:test';

import { retrieveAndJudge } from '../../src/features/qa/retrieve-and-judge.ts';

describe('c60: ContextStats system_tokens real counting', () => {
  it('system_tokens is nonzero when systemPrompt is provided', async () => {
    // Use no_sources path (no sourceIds) to get emptyStats quickly
    const result = await retrieveAndJudge({
      notebookId: 999,
      question: 'test question',
      systemPrompt: 'You are a helpful assistant that answers questions based on provided sources.',
    });
    expect(result.contextStats.system_tokens).toBeGreaterThan(0);
  });

  it('system_tokens is 0 when systemPrompt is absent', async () => {
    const result = await retrieveAndJudge({
      notebookId: 999,
      question: 'test question',
    });
    expect(result.contextStats.system_tokens).toBe(0);
  });

  it('system_tokens scales with systemPrompt length', async () => {
    const shortResult = await retrieveAndJudge({
      notebookId: 999,
      question: 'q',
      systemPrompt: 'Short prompt.',
    });
    const longResult = await retrieveAndJudge({
      notebookId: 999,
      question: 'q',
      systemPrompt: 'You are a helpful assistant. '.repeat(100),
    });
    expect(longResult.contextStats.system_tokens).toBeGreaterThan(
      shortResult.contextStats.system_tokens,
    );
  });

  it('total_tokens includes system_tokens', async () => {
    const result = await retrieveAndJudge({
      notebookId: 999,
      question: 'test',
      systemPrompt: 'System prompt with some tokens here.',
    });
    expect(result.contextStats.total_tokens).toBeGreaterThanOrEqual(
      result.contextStats.system_tokens + result.contextStats.query_tokens,
    );
  });
});
