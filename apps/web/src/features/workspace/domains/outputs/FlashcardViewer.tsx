import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProgressIndicator } from './StudioPrimitives';

export interface FlashcardItem {
  question?: string | null;
  answer?: string | null;
}

interface FlashcardViewerProps {
  items: FlashcardItem[];
  className?: string;
}

export default function FlashcardViewer({ items, className }: FlashcardViewerProps) {
  const total = items.length;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [items]);

  const card = useMemo(() => items[index] ?? {}, [items, index]);

  const handlePrev = useCallback(() => {
    setIndex((prev) => Math.max(0, prev - 1));
    setFlipped(false);
  }, []);

  const handleNext = useCallback(() => {
    setIndex((prev) => Math.min(total - 1, prev + 1));
    setFlipped(false);
  }, [total]);

  const handleFlip = useCallback(() => {
    setFlipped((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        handleFlip();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrev();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [handleFlip, handleNext, handlePrev]);

  if (total === 0) {
    return <div className="text-sm text-gray-500 dark:text-slate-400">暂无闪卡内容。</div>;
  }

  return (
    <div className={className}>
      <ProgressIndicator current={index + 1} total={total} label="学习进度" />
      <div className="mt-4">
        <div className="relative h-56 w-full [perspective:1200px]">
          <button
            type="button"
            className="absolute inset-0 h-full w-full rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
            onClick={handleFlip}
            aria-pressed={flipped}
            aria-label={flipped ? '查看问题' : '查看答案'}
          >
            <div
              className="relative h-full w-full rounded-2xl transition-transform duration-200"
              style={{
                transformStyle: 'preserve-3d',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              <div
                className="absolute inset-0 flex h-full w-full items-center justify-center rounded-2xl px-6 text-center"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
                    问题
                  </div>
                  <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {/* intentionally || — empty string is missing */}
                    {/* oxlint-disable-next-line typescript/prefer-nullish-coalescing */}
                    {card.question || '暂无问题'}
                  </div>
                </div>
              </div>
              <div
                className="absolute inset-0 flex h-full w-full items-center justify-center rounded-2xl px-6 text-center"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
                    答案
                  </div>
                  <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {/* intentionally || — empty string is missing */}
                    {/* oxlint-disable-next-line typescript/prefer-nullish-coalescing */}
                    {card.answer || '暂无答案'}
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-gray-500 dark:text-slate-400">空格翻转 · 左右键切换</div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
              onClick={handlePrev}
              disabled={index === 0}
            >
              上一张
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-900 bg-gray-900 px-3 py-1 text-xs font-semibold text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950"
              onClick={handleFlip}
            >
              翻转
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
              onClick={handleNext}
              disabled={index === total - 1}
            >
              下一张
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
