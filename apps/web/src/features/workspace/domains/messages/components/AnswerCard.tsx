type AnswerCardProps = {
  markdown: string;
};

export default function AnswerCard({ markdown }: AnswerCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-slate-100">
        {markdown}
      </div>
    </div>
  );
}
