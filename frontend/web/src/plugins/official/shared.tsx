import type { ReactNode } from 'react';

export function FallbackWarning() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <span aria-hidden="true">⚠️</span>
        <div className="space-y-1">
          <div>AI 模型生成失败。这可能是因为模型能力不足或响应格式不正确。建议：</div>
          <ul className="list-disc pl-4">
            <li>稍后重试</li>
            <li>使用更强大的 AI 模型（如 GPT-4、Claude 等）</li>
            <li>简化提示内容</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function OutputError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
      {message}
    </div>
  );
}

export interface BundleRenderFn {
  (content: unknown, isFallback?: boolean): ReactNode;
}
