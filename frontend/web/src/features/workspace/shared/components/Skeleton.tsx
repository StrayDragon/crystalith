import { memo } from 'react';

type SkeletonLineProps = {
  className?: string;
};

type SkeletonCardProps = {
  lines?: number;
  className?: string;
};

type SkeletonListProps = {
  items?: number;
  shortEvery?: number;
  className?: string;
};

export const SkeletonLine = memo(function SkeletonLine({ className = '' }: SkeletonLineProps) {
  return <div className={`h-3 rounded bg-gray-200 animate-pulse ${className}`.trim()} />;
});

export const SkeletonCard = memo(function SkeletonCard({
  lines = 3,
  className = '',
}: SkeletonCardProps) {
  const safeLines = Math.max(1, lines);
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 ${className}`.trim()}>
      <div className="flex flex-col gap-2">
        {Array.from({ length: safeLines }).map((_, index) => (
          <SkeletonLine
            key={`skeleton-card-line-${index}`}
            className={index === safeLines - 1 ? 'w-2/3' : 'w-full'}
          />
        ))}
      </div>
    </div>
  );
});

export const SkeletonList = memo(function SkeletonList({
  items = 3,
  shortEvery = 3,
  className = '',
}: SkeletonListProps) {
  const safeItems = Math.max(1, items);
  const safeShortEvery = Math.max(1, shortEvery);
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      {Array.from({ length: safeItems }).map((_, index) => (
        <div
          key={`skeleton-list-item-${index}`}
          className={`h-10 rounded-lg bg-gray-100 animate-pulse ${
            (index + 1) % safeShortEvery === 0 ? 'w-2/3' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
});
