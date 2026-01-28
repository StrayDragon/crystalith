import { useMemo, useRef } from 'react';

import { CollapsibleSection } from './StudioPrimitives';

export interface ReportSection {
  heading?: string | null;
  points?: Array<{ text?: string | null }> | null;
}

interface ReportViewerProps {
  sections: ReportSection[];
  className?: string;
}

export default function ReportViewer({ sections, className }: ReportViewerProps) {
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const toc = useMemo(
    () => sections.map((section, index) => ({
      id: `report-section-${index}`,
      title: section.heading || `章节 ${index + 1}`,
    })),
    [sections],
  );

  if (sections.length === 0) {
    return <div className="text-sm text-gray-500">暂无报告内容。</div>;
  }

  return (
    <div className={`grid gap-4 md:grid-cols-[220px_1fr] ${className ?? ''}`.trim()}>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">目录</div>
        <div className="mt-3 space-y-1">
          {toc.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="block w-full truncate rounded-md px-2 py-1 text-left text-xs font-medium text-gray-600 hover:bg-gray-100"
              onClick={() => sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {sections.map((section, index) => {
          const points = section.points ?? [];
          return (
            <div key={`section-${index}`} ref={(el) => { sectionRefs.current[index] = el; }}>
              <CollapsibleSection
                id={`report-section-${index}`}
                title={section.heading || `章节 ${index + 1}`}
                defaultOpen={index === 0}
              >
                {points.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm text-gray-700">
                    {points.map((point, pointIndex) => (
                      <li key={`${index}-${pointIndex}`}>{point.text || '内容'}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500">暂无内容。</div>
                )}
              </CollapsibleSection>
            </div>
          );
        })}
      </div>
    </div>
  );
}
