// c59 tests — fallback title source + nested backfill + _postprocessed flag.
import { describe, expect, it } from 'bun:test';

import {
  ensureMinimumContentFields,
  generateFallbackContent,
} from '../../src/features/outputs/pipeline.ts';

describe('c59: generateFallbackContent uses prompt as title', () => {
  it('FAQ fallback question contains the user prompt', () => {
    const fb = generateFallbackContent('FAQ', '量子计算原理');
    const items = fb.items as Array<Record<string, unknown>>;
    expect(items[0]?.question).toContain('量子计算原理');
    expect(items[0]?.question).not.toContain('TypeValidationError');
  });

  it('MINDMAP fallback label contains the prompt', () => {
    const fb = generateFallbackContent('MINDMAP', '机器学习入门');
    const root = fb.root as Record<string, unknown>;
    expect(root.label).toContain('机器学习入门');
  });

  it('does NOT use error.message as title', () => {
    const err = new Error('TypeValidationError: schema mismatch at /items/0');
    const fb = generateFallbackContent('FAQ', '用户的问题', err);
    const items = fb.items as Array<Record<string, unknown>>;
    expect(String(items[0]?.question)).not.toContain('TypeValidationError');
    expect(String(items[0]?.question)).toContain('用户的问题');
  });

  it('truncates long prompts to 200 chars', () => {
    const longPrompt = 'A'.repeat(300);
    const fb = generateFallbackContent('FAQ', longPrompt);
    const items = fb.items as Array<Record<string, unknown>>;
    expect(String(items[0]?.question).length).toBeLessThanOrEqual(200);
  });
});

describe('c59: ensureMinimumContentFields nested backfill', () => {
  it('GUIDE backfills objective {text, citations:[1]}', () => {
    const content = ensureMinimumContentFields({ modules: [{ title: 'My Guide' }] }, 'GUIDE');
    const mod = (content.modules as Array<Record<string, unknown>>)[0]!;
    const obj = mod.objective as Record<string, unknown>;
    expect(obj.text).toBe('My Guide');
    expect(obj.citations).toEqual([1]);
  });

  it('GUIDE backfills key_points with a leaf', () => {
    const content = ensureMinimumContentFields({ modules: [{}] }, 'GUIDE');
    const mod = (content.modules as Array<Record<string, unknown>>)[0]!;
    const kp = mod.key_points as Array<Record<string, unknown>>;
    expect(kp[0]?.citations).toEqual([1]);
  });

  it('MINDMAP backfills root.citations + synthetic child', () => {
    const content = ensureMinimumContentFields({ root: { label: 'topic' } }, 'MINDMAP');
    const root = content.root as Record<string, unknown>;
    expect(root.citations).toEqual([1]);
    const children = root.children as Array<Record<string, unknown>>;
    expect(children[0]?.citations).toEqual([1]);
  });

  it('BRIEFING backfills points with a leaf', () => {
    const content = ensureMinimumContentFields({ sections: [{ heading: 'Overview' }] }, 'BRIEFING');
    const sec = (content.sections as Array<Record<string, unknown>>)[0]!;
    const pts = sec.points as Array<Record<string, unknown>>;
    expect(pts[0]?.citations).toEqual([1]);
  });

  it('PARAGRAPH backfills citations:[1]', () => {
    const content = ensureMinimumContentFields({ text: 'hello' }, 'PARAGRAPH');
    expect(content.citations).toEqual([1]);
  });

  it('FAQ items get citations:[1] if missing', () => {
    const content = ensureMinimumContentFields({ items: [{ question: 'q', answer: 'a' }] }, 'FAQ');
    const item = (content.items as Array<Record<string, unknown>>)[0]!;
    expect(item.citations).toEqual([1]);
  });
});
