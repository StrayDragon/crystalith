import { describe, expect, it } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import QuizRunner from './QuizRunner';
import type { QuizQuestion } from './QuizRunner';

// covers: r303
// quiz 输出支持作答（选择/输入）→ 即时反馈（对/错 + 正确答案 + 解析）→
// 全部完成后结果汇总（正确率与计数）→ 可重做。

const QUESTIONS: QuizQuestion[] = [
  {
    question: '晶体是什么？',
    options: ['A. 固体', 'B. 液体'],
    answer: 'A',
    explanation: '晶体是原子有序排列的固体。',
  },
  {
    question: '第二题：光速约为？',
    options: ['A. 30万km/s', 'B. 声速'],
    answer: 'A',
  },
];

function answerCurrent(optionText: string) {
  fireEvent.click(screen.getByRole('button', { name: optionText }));
  fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
}

describe('r303 quiz answering with immediate feedback', () => {
  it('shows instant correctness feedback after submitting an answer', () => {
    render(<QuizRunner questions={QUESTIONS} />);
    answerCurrent('A. 固体');
    expect(screen.getByText('回答正确')).toBeTruthy();
    expect(screen.getByText(/解析：晶体是原子有序排列的固体/)).toBeTruthy();
  });

  it('shows the correct answer on a wrong submission', () => {
    render(<QuizRunner questions={QUESTIONS} />);
    answerCurrent('B. 液体');
    expect(screen.getByText('回答错误')).toBeTruthy();
    expect(screen.getByText(/正确答案：A/)).toBeTruthy();
  });

  it('aggregates the final score after all questions are answered and supports retry', () => {
    render(<QuizRunner questions={QUESTIONS} />);
    answerCurrent('A. 固体');
    fireEvent.click(screen.getByRole('button', { name: /下一题/ }));
    answerCurrent('A. 30万km/s');
    expect(screen.getByText('正确率 100%')).toBeTruthy();
    expect(screen.getByText('答对 2 / 2 题')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '再做一次' }));
    expect(screen.getByText(/第一题|题目 1/)).toBeTruthy();
    expect(screen.queryByText('正确率 100%')).toBeNull();
  });

  it('scores mixed results accurately (one correct of two = 50%)', () => {
    render(<QuizRunner questions={QUESTIONS} />);
    answerCurrent('B. 液体');
    fireEvent.click(screen.getByRole('button', { name: /下一题/ }));
    answerCurrent('A. 30万km/s');
    expect(screen.getByText('正确率 50%')).toBeTruthy();
    expect(screen.getByText('答对 1 / 2 题')).toBeTruthy();
  });
});
