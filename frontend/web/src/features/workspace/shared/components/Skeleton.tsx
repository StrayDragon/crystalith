import { memo } from "react";

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

export const SkeletonLine = memo(function SkeletonLine({ className = "" }: SkeletonLineProps) {
  return <div className={`h-3 rounded bg-gray-200 animate-pulse ${className}`.trim()} />;
});

export const SkeletonCard = memo(function SkeletonCard({
  lines = 3,
  className = "",
}: SkeletonCardProps) {
  const safeLines = Math.max(1, lines);
  const lineIds = Array.from({ length: safeLines }, (_unused, index) => `line-${index}`);
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 ${className}`.trim()}>
      <div className="flex flex-col gap-2">
        {lineIds.map((lineId, index) => (
          <SkeletonLine key={lineId} className={index === safeLines - 1 ? "w-2/3" : "w-full"} />
        ))}
      </div>
    </div>
  );
});

export const SkeletonList = memo(function SkeletonList({
  items = 3,
  shortEvery = 3,
  className = "",
}: SkeletonListProps) {
  const safeItems = Math.max(1, items);
  const safeShortEvery = Math.max(1, shortEvery);
  const itemIds = Array.from({ length: safeItems }, (_unused, index) => `item-${index}`);
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      {itemIds.map((itemId, index) => (
        <div
          key={itemId}
          className={`h-10 rounded-lg bg-gray-100 animate-pulse ${
            (index + 1) % safeShortEvery === 0 ? "w-2/3" : "w-full"
          }`}
        />
      ))}
    </div>
  );
});
