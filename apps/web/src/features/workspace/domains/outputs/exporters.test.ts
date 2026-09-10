import { expect, test } from '@rstest/core';

import type { OutputItem, OutputTypeId } from '../../shared/types';
import {
  buildExportFileName,
  buildJsonExport,
  buildMarkdownExport,
  buildSlidesExportItems,
  getSupportedExportFormats,
} from './exporters';

function createOutput(type: OutputTypeId, content: Record<string, unknown>): OutputItem {
  return {
    id: 1,
    type,
    prompt: `${type} prompt`,
    chunkIds: [1],
    content,
    contentLoaded: true,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
  };
}

test('format mapping includes special exports', () => {
  expect(getSupportedExportFormats('QUIZ')).toEqual(['markdown', 'json']);
  expect(getSupportedExportFormats('SLIDES')).toEqual(['markdown', 'pptx']);
  expect(getSupportedExportFormats('BRIEFING')).toEqual(['markdown', 'pdf']);
  expect(getSupportedExportFormats('TIMELINE')).toEqual(['markdown']);
});

test('buildMarkdownExport keeps FAQ complete content', () => {
  const output = createOutput('FAQ', {
    items: [
      { question: '什么是 RAG？', answer: '检索增强生成。' },
      { question: '为什么需要引用？', answer: '提高可验证性。' },
    ],
  });

  const markdown = buildMarkdownExport(output);

  expect(markdown).toContain('# FAQ prompt');
  expect(markdown).toContain('Q: 什么是 RAG？');
  expect(markdown).toContain('A: 检索增强生成。');
  expect(markdown).toContain('Q: 为什么需要引用？');
});

test('buildMarkdownExport keeps guide/timeline/briefing readable', () => {
  const guide = buildMarkdownExport(
    createOutput('GUIDE', {
      modules: [
        { title: '模块一', objective: { text: '理解基础' }, keyPoints: [{ text: '要点 A' }] },
      ],
    }),
  );
  const timeline = buildMarkdownExport(
    createOutput('TIMELINE', {
      events: [{ date: '2024', event: '发布', description: '发布了新版本' }],
    }),
  );
  const briefing = buildMarkdownExport(
    createOutput('BRIEFING', {
      sections: [{ heading: '重点', points: [{ text: '性能提升' }] }],
    }),
  );

  expect(guide).toContain('模块一');
  expect(guide).toContain('目标：理解基础');
  expect(timeline).toContain('2024 · 发布 · 发布了新版本');
  expect(briefing).toContain('重点');
});

test('buildJsonExport outputs flashcard and quiz schemas', () => {
  const faqJson = buildJsonExport(
    createOutput('FAQ', {
      items: [{ question: 'Q1', answer: 'A1' }],
    }),
  );
  const quizJson = buildJsonExport(
    createOutput('QUIZ', {
      questions: [{ question: '2+2?', options: ['3', '4'], answer: '4', explanation: '基础算术' }],
    }),
  );

  expect(faqJson.schema).toBe('crystalith.flashcards.v1');
  expect((faqJson.items as any[]).length).toBe(1);
  expect((faqJson.items as any[])[0].front).toBe('Q1');

  expect(quizJson.schema).toBe('crystalith.quiz.v1');
  expect((quizJson.questions as any[]).length).toBe(1);
  expect((quizJson.questions as any[])[0].answer).toBe('4');
});

test('buildSlidesExportItems supports outline and markdown fallback', () => {
  const outlineSlides = buildSlidesExportItems(
    createOutput('SLIDES', {
      outline: {
        slides: [
          { title: '第一页', bullets: ['A', 'B'] },
          { title: '第二页', bullets: ['C'] },
        ],
      },
    }),
  );
  expect(outlineSlides).toHaveLength(2);
  expect(outlineSlides[0].title).toBe('第一页');

  const markdownSlides = buildSlidesExportItems(
    createOutput('SLIDES', {
      markdown: '# 总览\n\n## 章节一\n- 重点一\n- 重点二\n',
    }),
  );
  expect(markdownSlides.length).toBeGreaterThan(0);
  expect(markdownSlides[0].title).toContain('总览');
});

test('buildExportFileName sanitizes extension', () => {
  const output = createOutput('FAQ', { title: 'A/B:C*D' });
  const markdownFile = buildExportFileName(output, 'markdown');
  const jsonFile = buildExportFileName(output, 'json');

  expect(markdownFile.endsWith('.md')).toBe(true);
  expect(jsonFile.endsWith('.json')).toBe(true);
  expect(markdownFile).not.toContain('/');
});
