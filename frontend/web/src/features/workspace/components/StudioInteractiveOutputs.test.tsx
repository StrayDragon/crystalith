import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import FlashcardViewer from './FlashcardViewer';
import GuideChecklist from './GuideChecklist';
import QuizRunner from './QuizRunner';
import ReportViewer from './ReportViewer';
import TimelineViewer from './TimelineViewer';
import CitationActions from './citations/CitationActions';
import CitationList from './citations/CitationList';
import type { Citation } from '../types';

const sampleCitations: Citation[] = [
  {
    id: '1',
    chunkId: 11,
    sourceTitle: '需求说明.md',
    snippet: '短引用片段。',
    chunkIndex: 1,
    pageNumber: 2,
  },
  {
    id: '2',
    chunkId: 12,
    sourceTitle: '需求说明.md',
    snippet: '长引用片段'.repeat(40),
    chunkIndex: 2,
    pageNumber: 4,
  },
  {
    id: '3',
    chunkId: 21,
    sourceTitle: '访谈纪要.md',
    snippet: '第二来源的引用内容。',
    chunkIndex: 1,
    pageNumber: null,
  },
];

test('workspace interactive components respond to core actions', async () => {
  const onToggleCitation = vi.fn();
  const onCitationHover = vi.fn();
  const onSendSelected = vi.fn();
  const onCompareSelected = vi.fn();
  const onCopySelected = vi.fn();
  const onSelectAll = vi.fn();
  const onClearSelection = vi.fn();

  render(
    <div>
      <section data-testid="flashcard">
        <FlashcardViewer
          items={[{ question: '什么是闪卡？', answer: '用于自测的问答卡片。' }]}
        />
      </section>
      <section data-testid="quiz">
        <QuizRunner
          questions={[
            { question: '首都是什么？', options: ['北京', '上海'], answer: '北京' },
            { question: '2 + 2 = ?', options: ['3', '4'], answer: '4' },
          ]}
        />
      </section>
      <section data-testid="guide">
        <GuideChecklist
          modules={[
            { title: '模块一', objective: { text: '掌握基础概念' }, key_points: [{ text: '概念 A' }] },
            { title: '模块二', objective: { text: '理解进阶内容' }, key_points: [{ text: '概念 B' }] },
          ]}
        />
      </section>
      <section data-testid="report">
        <ReportViewer
          sections={[
            { heading: '背景', points: [{ text: '要点一' }] },
            { heading: '结论', points: [{ text: '要点二' }] },
          ]}
        />
      </section>
      <section data-testid="timeline">
        <TimelineViewer
          events={[
            { date: '2024', event: '发布', description: '事件详情说明' },
          ]}
        />
      </section>
      <section data-testid="citations">
        <CitationList
          citations={sampleCitations}
          selectedCitationIds={new Set()}
          highlightedChunkIds={new Set()}
          jumpToCitationChunkId={null}
          onToggleCitation={onToggleCitation}
          onCitationHover={onCitationHover}
        />
        <CitationActions
          selectedCount={2}
          totalCount={3}
          onSendSelected={onSendSelected}
          onCompareSelected={onCompareSelected}
          onCopySelected={onCopySelected}
          onSelectAll={onSelectAll}
          onClearSelection={onClearSelection}
        />
      </section>
    </div>,
  );

  const flashcard = within(screen.getByTestId('flashcard'));
  const cardButton = flashcard.getByLabelText('查看答案');
  expect(cardButton).toHaveAttribute('aria-pressed', 'false');
  await userEvent.click(cardButton);
  expect(cardButton).toHaveAttribute('aria-pressed', 'true');

  const quiz = within(screen.getByTestId('quiz'));
  await userEvent.click(quiz.getByRole('button', { name: '北京' }));
  await userEvent.click(quiz.getByRole('button', { name: '提交答案' }));
  expect(await quiz.findByText('回答正确')).toBeInTheDocument();
  await userEvent.click(quiz.getByRole('button', { name: '下一题' }));
  await userEvent.click(quiz.getByRole('button', { name: '4' }));
  await userEvent.click(quiz.getByRole('button', { name: '提交答案' }));
  expect(await quiz.findByText(/正确率/)).toBeInTheDocument();

  const guide = within(screen.getByTestId('guide'));
  expect(guide.getByText('已完成 0 / 2')).toBeInTheDocument();
  const [checkbox] = guide.getAllByLabelText('未完成');
  await userEvent.click(checkbox);
  expect(guide.getByText('已完成 1 / 2')).toBeInTheDocument();

  const report = within(screen.getByTestId('report'));
  expect(report.getByText('要点一')).toBeInTheDocument();
  await userEvent.click(report.getByRole('button', { name: /背景/, expanded: true }));
  expect(report.queryByText('要点一')).not.toBeInTheDocument();

  const timeline = within(screen.getByTestId('timeline'));
  expect(timeline.queryByText('事件详情说明')).not.toBeInTheDocument();
  await userEvent.click(timeline.getByRole('button', { name: /发布/ }));
  expect(timeline.getByText('事件详情说明')).toBeInTheDocument();

  const citations = within(screen.getByTestId('citations'));
  expect(citations.getByText('需求说明.md')).toBeInTheDocument();
  expect(citations.getByText('访谈纪要.md')).toBeInTheDocument();
  const expandButton = citations.getByRole('button', { name: '展开' });
  expect(expandButton).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(expandButton);
  expect(expandButton).toHaveAttribute('aria-expanded', 'true');

  await userEvent.click(citations.getByRole('button', { name: '发送至提炼' }));
  await userEvent.click(citations.getByRole('button', { name: '对比分析' }));
  await userEvent.click(citations.getByRole('button', { name: '复制引用' }));
  await userEvent.click(citations.getByRole('button', { name: '全选' }));
  await userEvent.click(citations.getByRole('button', { name: '清空' }));

  expect(onSendSelected).toHaveBeenCalledTimes(1);
  expect(onCompareSelected).toHaveBeenCalledTimes(1);
  expect(onCopySelected).toHaveBeenCalledTimes(1);
  expect(onSelectAll).toHaveBeenCalledTimes(1);
  expect(onClearSelection).toHaveBeenCalledTimes(1);
});
