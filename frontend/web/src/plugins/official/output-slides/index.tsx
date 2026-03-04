import { decodeOutputContent } from '../../../features/workspace/shared/outputPayload';

import { FallbackWarning, OutputError } from '../shared';

export function render(content: unknown, isFallback?: boolean) {
  const slides = decodeOutputContent('SLIDES', content);
  if (!slides) return <OutputError message="无效的演示数据" />;

  const title = slides.title || '演示';
  const outline = slides.outline;
  const markdown = slides.markdown;

  return (
    <div className="space-y-4">
      {isFallback ? <FallbackWarning /> : null}
      <div>
        <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</div>
        <div className="text-xs text-gray-500 dark:text-slate-400">
          引擎：{slides.engine || 'slidev'}
        </div>
      </div>
      {Array.isArray(outline?.slides) ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs font-semibold text-gray-600 mb-2 dark:text-slate-300">大纲</div>
          <div className="space-y-2 text-sm text-gray-800 dark:text-slate-200">
            {outline.slides.map((slide, index) => (
              <div key={`${slide.title}-${index}`}>
                <div className="font-semibold">{slide.title || `幻灯片 ${index + 1}`}</div>
                {Array.isArray(slide.bullets) && slide.bullets.length > 0 ? (
                  <ul className="list-disc pl-5 text-xs text-gray-600 dark:text-slate-400">
                    {slide.bullets.map((bullet, idx) => (
                      <li key={`${bullet}-${idx}`}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {markdown ? (
        <pre className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {markdown}
        </pre>
      ) : (
        <div className="text-xs text-gray-500 dark:text-slate-400">尚未生成 Markdown。</div>
      )}
    </div>
  );
}
