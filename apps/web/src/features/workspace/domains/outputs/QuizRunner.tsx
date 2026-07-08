import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProgressIndicator } from './StudioPrimitives';

export interface QuizQuestion {
  question?: string | null;
  options?: string[] | null;
  answer?: string | string[] | null;
  explanation?: string | null;
}

interface QuizRunnerProps {
  questions: QuizQuestion[];
  className?: string;
}

interface AnswerState {
  selected?: string;
  submitted?: boolean;
  isCorrect?: boolean;
}

function normalize(value: string | undefined | null): string {
  return (value ?? '').toString().trim().toLowerCase();
}

function resolveCorrect(answer: QuizQuestion['answer']): string[] {
  if (Array.isArray(answer)) return answer.filter(Boolean).map((item) => item.toString());
  if (typeof answer === 'string') return [answer];
  return [];
}

export default function QuizRunner({ questions, className }: QuizRunnerProps) {
  const total = questions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() => questions.map(() => ({})));

  const current = questions[currentIndex];
  const currentAnswer = answers[currentIndex] ?? {};
  const correctAnswers = useMemo(() => resolveCorrect(current?.answer), [current]);

  useEffect(() => {
    setAnswers(questions.map(() => ({})));
    setCurrentIndex(0);
  }, [questions]);

  const completedCount = useMemo(
    () => answers.filter((answer) => answer.submitted).length,
    [answers],
  );

  const score = useMemo(
    () => answers.filter((answer) => answer.submitted && answer.isCorrect).length,
    [answers],
  );

  const handleSelect = useCallback(
    (value: string) => {
      setAnswers((prev) =>
        prev.map((answer, index) =>
          index === currentIndex ? { ...answer, selected: value } : answer,
        ),
      );
    },
    [currentIndex],
  );

  const handleSubmit = useCallback(() => {
    const selected = currentAnswer.selected;
    if (!selected) return;
    const isCorrect = correctAnswers.some((value) => normalize(value) === normalize(selected));
    setAnswers((prev) =>
      prev.map((answer, index) =>
        index === currentIndex ? { ...answer, submitted: true, isCorrect } : answer,
      ),
    );
  }, [correctAnswers, currentAnswer.selected, currentIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(total - 1, prev + 1));
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const resetQuiz = useCallback(() => {
    setAnswers(questions.map(() => ({})));
    setCurrentIndex(0);
  }, [questions]);

  if (total === 0) {
    return <div className="text-sm text-gray-500 dark:text-slate-400">暂无测验内容。</div>;
  }

  if (completedCount === total) {
    const accuracy = total ? Math.round((score / total) * 100) : 0;
    return (
      <div className={className}>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            测验结果
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">
            正确率 {accuracy}%
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-slate-300">
            答对 {score} / {total} 题
          </div>
          <button
            type="button"
            className="mt-4 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white dark:bg-sky-500 dark:text-slate-950"
            onClick={resetQuiz}
          >
            再做一次
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ProgressIndicator current={currentIndex + 1} total={total} label="测验进度" />
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
          题目 {currentIndex + 1}
        </div>
        <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
          {current?.question || '暂无题目'}
        </div>
        {Array.isArray(current?.options) && current.options.length > 0 ? (
          <div className="mt-4 space-y-2">
            {current.options.map((option) => {
              const selected = currentAnswer.selected === option;
              return (
                <button
                  key={option}
                  type="button"
                  className={`w-full rounded-lg border px-4 py-2 text-left text-sm transition ${
                    selected
                      ? 'border-gray-900 bg-gray-900 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => handleSelect(option)}
                  disabled={currentAnswer.submitted}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <input
              type="text"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="输入你的答案"
              value={currentAnswer.selected ?? ''}
              onChange={(event) => handleSelect(event.target.value)}
              disabled={currentAnswer.submitted}
              name="quizAnswer"
              aria-label="输入你的答案"
            />
          </div>
        )}
        {currentAnswer.submitted ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-slate-600 dark:bg-slate-800">
            <div
              className={`font-semibold ${currentAnswer.isCorrect ? 'text-green-600' : 'text-rose-600'}`}
            >
              {currentAnswer.isCorrect ? '回答正确' : '回答错误'}
            </div>
            {!currentAnswer.isCorrect && correctAnswers.length > 0 ? (
              <div className="mt-1 text-gray-700 dark:text-slate-200">
                正确答案：{correctAnswers.join(' / ')}
              </div>
            ) : null}
            {current?.explanation ? (
              <div className="mt-1 text-gray-500 dark:text-slate-400">
                解析：{current.explanation}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
            onClick={goPrev}
            disabled={currentIndex === 0}
          >
            上一题
          </button>
          {currentAnswer.submitted ? (
            <button
              type="button"
              className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white dark:bg-sky-500 dark:text-slate-950"
              onClick={goNext}
              disabled={currentIndex === total - 1}
            >
              下一题
            </button>
          ) : (
            <button
              type="button"
              className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-sky-500 dark:text-slate-950"
              onClick={handleSubmit}
              disabled={!currentAnswer.selected}
            >
              提交答案
            </button>
          )}
        </div>
        {currentIndex === total - 1 && currentAnswer.submitted ? (
          <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
            完成后将自动显示结果。
          </div>
        ) : null}
      </div>
    </div>
  );
}
