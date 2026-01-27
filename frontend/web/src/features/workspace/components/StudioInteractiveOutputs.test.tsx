import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import FlashcardViewer from './FlashcardViewer';
import GuideChecklist from './GuideChecklist';
import QuizRunner from './QuizRunner';
import ReportViewer from './ReportViewer';
import TimelineViewer from './TimelineViewer';

test('flashcard viewer flips between sides', async () => {
  render(
    <FlashcardViewer
      items={[{ question: '什么是闪卡？', answer: '用于自测的问答卡片。' }]}
    />,
  );

  const cardButton = screen.getByLabelText('查看答案');
  expect(cardButton).toHaveAttribute('aria-pressed', 'false');
  await userEvent.click(cardButton);
  expect(cardButton).toHaveAttribute('aria-pressed', 'true');
});

test('quiz runner submits answers and shows results', async () => {
  render(
    <QuizRunner
      questions={[
        { question: '首都是什么？', options: ['北京', '上海'], answer: '北京' },
        { question: '2 + 2 = ?', options: ['3', '4'], answer: '4' },
      ]}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: '北京' }));
  await userEvent.click(screen.getByRole('button', { name: '提交答案' }));
  expect(await screen.findByText('回答正确')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '下一题' }));

  await userEvent.click(screen.getByRole('button', { name: '4' }));
  await userEvent.click(screen.getByRole('button', { name: '提交答案' }));
  expect(await screen.findByText(/正确率/)).toBeInTheDocument();
});

test('guide checklist updates progress after completing a module', async () => {
  render(
    <GuideChecklist
      modules={[
        { title: '模块一', objective: { text: '掌握基础概念' }, key_points: [{ text: '概念 A' }] },
        { title: '模块二', objective: { text: '理解进阶内容' }, key_points: [{ text: '概念 B' }] },
      ]}
    />,
  );

  expect(screen.getByText('已完成 0 / 2')).toBeInTheDocument();
  const [checkbox] = screen.getAllByLabelText('未完成');
  await userEvent.click(checkbox);
  expect(screen.getByText('已完成 1 / 2')).toBeInTheDocument();
});

test('report viewer collapses sections', async () => {
  render(
    <ReportViewer
      sections={[
        { heading: '背景', points: [{ text: '要点一' }] },
        { heading: '结论', points: [{ text: '要点二' }] },
      ]}
    />,
  );

  expect(screen.getByText('要点一')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /背景/, expanded: true }));
  expect(screen.queryByText('要点一')).not.toBeInTheDocument();
});

test('timeline viewer toggles event details', async () => {
  render(
    <TimelineViewer
      events={[
        { date: '2024', event: '发布', description: '事件详情说明' },
      ]}
    />,
  );

  expect(screen.queryByText('事件详情说明')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /发布/ }));
  expect(screen.getByText('事件详情说明')).toBeInTheDocument();
});
