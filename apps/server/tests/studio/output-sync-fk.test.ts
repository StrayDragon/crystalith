// covers: r306
// studio 输出同步（syncSlideOutput）MUST：
//   (1) 写 studioSlides.outputId 外键；
//   (2) content schema 为 camelCase：{title, engine, outline, markdown, slideId}；
//   依赖 slide→output join 的查询 MUST 使用 outputId FK（而非 prompt 约定）。
// 附带：重复同步复用同一 Output 行；legacy（prompt=studio:<id> 但 FK 为空）被回填。
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { eq } from 'drizzle-orm';

import { db } from '../../src/db/index.ts';
import { notebooks, outputs, studioSlides } from '../../src/db/schema.ts';
import { syncSlideOutput } from '../../src/features/studio/service.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  notebookId = getOrm().insert(notebooks).values({ name: 'studio-r306-fk' }).returning().get().id;
});

afterAll(teardownIntegrationEnv);

function insertSlide(overrides?: Partial<typeof studioSlides.$inferInsert>) {
  return db()
    .insert(studioSlides)
    .values({ notebookId, title: 'R306 Deck', ...overrides })
    .returning()
    .get();
}

describe('studio output sync writes outputId FK + camelCase content (r306)', () => {
  it('first sync inserts an Output row and backfills studioSlides.outputId', () => {
    const slide = insertSlide();

    syncSlideOutput(slide, '# R306\n- hello\n');

    const synced = db().select().from(studioSlides).where(eq(studioSlides.id, slide.id)).get()!;
    // (1) FK 已写入
    expect(synced.outputId).toBeGreaterThan(0);

    // join MUST 走 outputId
    const output = db().select().from(outputs).where(eq(outputs.id, synced.outputId!)).get()!;
    expect(output).toBeTruthy();
    expect(output.type).toBe('SLIDES');
    expect(output.notebookId).toBe(notebookId);

    // (2) content schema 为 camelCase 全量形状
    const content = output.content as Record<string, unknown>;
    expect(Object.keys(content).sort()).toEqual(
      ['engine', 'markdown', 'outline', 'slideId', 'title'].sort(),
    );
    expect(content.title).toBe('R306 Deck');
    expect(content.engine).toBe('slidev');
    expect(content.markdown).toBe('# R306\n- hello\n');
    expect(content.slideId).toBe(slide.id);
  });

  it('re-sync updates the same Output row via the FK instead of inserting a new one', () => {
    const slide = insertSlide();
    syncSlideOutput(slide, 'v1');
    const first = db().select().from(studioSlides).where(eq(studioSlides.id, slide.id)).get()!;

    syncSlideOutput(first, 'v2');

    const rows = db()
      .select()
      .from(outputs)
      .where(eq(outputs.prompt, `studio:${slide.id}`))
      .all();
    expect(rows).toHaveLength(1);
    const again = db().select().from(studioSlides).where(eq(studioSlides.id, slide.id)).get()!;
    expect(again.outputId).toBe(first.outputId);
    expect(
      (
        db().select().from(outputs).where(eq(outputs.id, first.outputId!)).get()!.content as Record<
          string,
          unknown
        >
      ).markdown,
    ).toBe('v2');
  });

  it('legacy slide (prompt convention, null FK) reuses the existing output and backfills the FK', () => {
    const slide = insertSlide();
    // pre-c51 遗留：已存在 prompt=studio:<id> 的 Output，但 slide.outputId 为空
    const legacy = db()
      .insert(outputs)
      .values({
        notebookId,
        type: 'SLIDES',
        prompt: `studio:${slide.id}`,
        content: { title: 'legacy' },
      })
      .returning()
      .get();

    syncSlideOutput(slide, 'legacy markdown');

    const outputsForPrompt = db()
      .select()
      .from(outputs)
      .where(eq(outputs.prompt, `studio:${slide.id}`))
      .all();
    expect(outputsForPrompt).toHaveLength(1);

    const synced = db().select().from(studioSlides).where(eq(studioSlides.id, slide.id)).get()!;
    expect(synced.outputId).toBe(legacy.id);
    expect((outputsForPrompt[0]!.content as Record<string, unknown>).markdown).toBe(
      'legacy markdown',
    );
  });
});
