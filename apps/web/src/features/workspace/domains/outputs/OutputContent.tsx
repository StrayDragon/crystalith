import { Menu, MenuHandler, MenuList, MenuItem, Spinner } from '@material-tailwind/react';
import {
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getBuiltinBundleLoader } from '../../../../plugins/official/registry';
import { t } from '../../../../shared/i18n';
import { LAYER_LEVELS } from '../../../../shared/layer';
import {
  decodeOutputContent,
  getOutputPayloadWarnings,
  isFallbackOutputPayload,
} from '../../shared/outputPayload';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { OutputItem, OutputTypeId } from '../../shared/types';
import { EXPORT_FORMAT_LABELS } from './exporters';
import FlashcardViewer from './FlashcardViewer';
import GenericOutputRenderer from './GenericOutputRenderer';
import GuideChecklist from './GuideChecklist';
import { MindmapViewer, type MindmapNode } from './MindmapViewer';
import QuizRunner from './QuizRunner';
import ReportViewer from './ReportViewer';
import TimelineViewer from './TimelineViewer';
import { useExport } from './useExport';

/** Normalize raw content to MindmapViewer-compatible nodes. */
function normalizeMindmapNode(node: unknown): MindmapNode {
  if (!node || typeof node !== 'object') return { label: typeof node === 'string' ? node : '' };
  const record = node as Record<string, unknown>;
  const label =
    typeof record.label === 'string'
      ? record.label
      : typeof record.label === 'string'
        ? record.label
        : typeof record.label === 'string'
          ? record.label
          : '';
  const children = Array.isArray(record.children)
    ? record.children.map((child) => normalizeMindmapNode(child))
    : undefined;
  return { label, children };
}

interface OutputContentProps {
  output: OutputItem;
  /** Called when user clicks retry on a failed (fallback) output. */
  onRetry?: (output: OutputItem) => void;
  /** Called when user clicks delete on a failed (fallback) output. */
  onDelete?: (outputId: number) => void;
}

type BundleRenderer = (content: unknown, isFallback?: boolean) => ReactNode;

const EMPTY_OUTPUT_CONTENT: Record<string, never> = {};

export default function OutputContent({ output, onRetry, onDelete }: OutputContentProps) {
  const content = output.content ?? EMPTY_OUTPUT_CONTENT;
  const isFallback = isFallbackOutputPayload(content);
  const warnings = useMemo(() => getOutputPayloadWarnings(content), [content]);
  const warningKeyCounts = new Map<string, number>();
  const typeId = output.type as OutputTypeId;
  const { isExporting, activeFormat, getSupportedFormats, exportOutput } = useExport();
  const renderDescriptor = useWorkspaceStore((s) => s.outputTypeRenderDescriptors[typeId] ?? null);
  const frontendBundle = useWorkspaceStore((s) => s.outputTypeFrontendBundles[typeId] ?? null);
  const frontendBundleApiVersion = frontendBundle?.apiVersion ?? null;
  const frontendBundleExport = frontendBundle?.export ?? null;
  const frontendBundleId = frontendBundle?.id ?? null;
  const frontendBundleKind = frontendBundle?.kind ?? null;
  const [bundleRenderer, setBundleRenderer] = useState<BundleRenderer | null>(null);

  const supportedFormats = useMemo(
    () => getSupportedFormats(typeId),
    [getSupportedFormats, typeId],
  );

  useEffect(() => {
    let cancelled = false;
    setBundleRenderer(null);

    if (frontendBundleApiVersion !== 'v1') return () => {};
    if (frontendBundleKind !== 'builtin') return () => {};
    if (!frontendBundleId || !frontendBundleExport) return () => {};

    const loader = getBuiltinBundleLoader(frontendBundleId);
    if (!loader) {
      if (import.meta.env.DEV) {
        console.warn(`Missing builtin frontend bundle loader: ${frontendBundleId}`);
      }
      return () => {};
    }

    void loader()
      .then((mod) => {
        const exported = (mod as unknown as Record<string, unknown>)[frontendBundleExport];
        if (typeof exported !== 'function') {
          if (import.meta.env.DEV) {
            console.warn(
              `Invalid frontend bundle export "${frontendBundleExport}" for "${frontendBundleId}"`,
            );
          }
          return;
        }
        if (cancelled) return;
        setBundleRenderer(() => exported as BundleRenderer);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn(`Failed to load frontend bundle "${frontendBundleId}"`, error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [frontendBundleApiVersion, frontendBundleExport, frontendBundleId, frontendBundleKind]);

  // Fallback content: generation failed — show error with actions instead of content.
  if (isFallback) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
          <WarningIcon className="h-8 w-8 text-red-500 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-slate-100">
          内容生成失败
        </h3>
        <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-slate-400">
          AI 未能成功生成此{output.type}类型的内容，可能是模型配置问题或上下文不足。
        </p>
        <div className="mt-6 flex items-center gap-3">
          {onRetry ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              onClick={() => onRetry(output)}
            >
              <RefreshIcon style={{ fontSize: 16 }} />
              重新生成
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={() => onDelete(output.id)}
            >
              <DeleteIcon style={{ fontSize: 16 }} />
              删除
            </button>
          ) : null}
        </div>
        <div className="mt-6 text-xs text-gray-400 dark:text-slate-500">
          {typeof content === 'object' && content !== null
            ? Object.keys(content as Record<string, unknown>).length > 0
              ? '输出存在部分数据处理异常'
              : '输出内容为空'
            : '输出内容格式异常'}
        </div>
      </div>
    );
  }

  const body = bundleRenderer ? (
    bundleRenderer(content, isFallback)
  ) : typeId === 'MINDMAP' &&
    content &&
    typeof content === 'object' &&
    'root' in (content as Record<string, unknown>) ? (
    <div className="StructuredMindmapInteractive h-[400px]">
      <MindmapViewer
        data={{ root: normalizeMindmapNode((content as Record<string, unknown>).root) }}
      />
    </div>
  ) : typeId === 'FAQ' && content && decodeOutputContent('FAQ', content) ? (
    <div className="StructuredOutputFaq">
      <FlashcardViewer items={decodeOutputContent('FAQ', content)!.items} />
    </div>
  ) : typeId === 'QUIZ' && content && decodeOutputContent('QUIZ', content) ? (
    <div className="StructuredOutputQuiz">
      <QuizRunner questions={decodeOutputContent('QUIZ', content)!.questions} />
    </div>
  ) : typeId === 'GUIDE' && content && decodeOutputContent('GUIDE', content) ? (
    <div className="StructuredOutputGuide">
      <GuideChecklist modules={decodeOutputContent('GUIDE', content)!.modules} />
    </div>
  ) : typeId === 'TIMELINE' && content && decodeOutputContent('TIMELINE', content) ? (
    <div className="StructuredOutputTimeline">
      <TimelineViewer events={decodeOutputContent('TIMELINE', content)!.events} />
    </div>
  ) : typeId === 'BRIEFING' && content && decodeOutputContent('BRIEFING', content) ? (
    <div className="StructuredOutputBriefing">
      <ReportViewer sections={decodeOutputContent('BRIEFING', content)!.sections} />
    </div>
  ) : renderDescriptor ? (
    <GenericOutputRenderer content={content} renderDescriptor={renderDescriptor} />
  ) : typeId === 'SLIDES' &&
    content &&
    typeof content === 'object' &&
    'markdown' in (content as Record<string, unknown>) ? (
    <SlidesMarkdownRenderer content={content as Record<string, unknown>} />
  ) : (
    <pre className="StructuredOutputRaw rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
      {JSON.stringify(output.content ?? {}, null, 2)}
    </pre>
  );

  return (
    <div className="space-y-3">
      {import.meta.env.DEV && warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="font-semibold">{t('common.debug_warnings')}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {warnings.map((warning) => {
              const ordinal = warningKeyCounts.get(warning) ?? 0;
              warningKeyCounts.set(warning, ordinal + 1);
              const warningKey = `${warning}:${ordinal}`;
              return (
                <span
                  key={warningKey}
                  className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-amber-500/20 dark:text-amber-100"
                >
                  {warning}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {isExporting && activeFormat ? (
          <span className="text-xs text-gray-500 dark:text-slate-300" aria-live="polite">
            正在导出 {EXPORT_FORMAT_LABELS[activeFormat]}...
          </span>
        ) : null}
        <Menu placement="bottom-end">
          <MenuHandler>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="导出输出"
              disabled={isExporting}
            >
              <DownloadIcon style={{ fontSize: 14 }} />
              导出
            </button>
          </MenuHandler>
          <MenuList
            className="p-1 min-w-[180px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700"
            style={{ zIndex: LAYER_LEVELS.dropdown }}
          >
            {supportedFormats.map((format) => {
              const formatLabel = EXPORT_FORMAT_LABELS[format];
              const isCurrent = isExporting && activeFormat === format;

              return (
                <MenuItem
                  key={format}
                  className="flex items-center justify-between gap-2 py-2 px-3 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
                  disabled={isExporting}
                  onClick={() => {
                    void exportOutput(output, format);
                  }}
                >
                  <span>导出为 {formatLabel}</span>
                  {isCurrent ? <Spinner className="h-3.5 w-3.5" /> : null}
                </MenuItem>
              );
            })}
          </MenuList>
        </Menu>
      </div>
      {body}
    </div>
  );
}

/**
 * Render a SLIDES output as markdown with slide separators.
 * Displays the Slidev markdown content with clear visual breaks between
 * slides, instead of falling back to raw JSON (which was the default for
 * SLIDES outputs that have no render_descriptor).
 */
function SlidesMarkdownRenderer({ content }: { content: Record<string, unknown> }) {
  const markdown = typeof content.markdown === 'string' ? content.markdown : '';
  const title = typeof content.title === 'string' ? content.title : '幻灯片';
  const engine = typeof content.engine === 'string' ? content.engine : 'slidev';

  if (!markdown) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
        该幻灯片输出没有 Markdown 内容。
      </div>
    );
  }

  // Split on slide separators (---) and strip frontmatter
  const slides = markdown
    .split(/\n---\n/u)
    .filter(Boolean)
    .map((s) => s.trim());

  // First block is usually frontmatter (YAML between --- delimiters)
  const hasFrontmatter = slides.length > 0 && slides[0]?.startsWith('---\n');
  const contentSlides = hasFrontmatter ? slides.slice(1) : slides;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
        <span className="font-semibold">{title}</span>
        <span>·</span>
        <span>{engine}</span>
        <span>·</span>
        <span>{contentSlides.length} 页幻灯片</span>
      </div>

      <div className="space-y-4">
        {contentSlides.map((slide, i) => {
          // Extract title from first heading line
          const lines = slide.split('\n');
          const headingLine = lines.find((l) => l.startsWith('#'));
          const slideTitle = headingLine ? headingLine.replace(/^#+\s*/u, '') : `第 ${i + 1} 页`;

          return (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white dark:bg-slate-600">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {slideTitle}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-700 dark:text-slate-300">
                {lines
                  .filter((l) => !l.startsWith('#') && l.trim())
                  .slice(0, 10)
                  .map((line, j) => (
                    <div key={j} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-300 dark:bg-slate-600" />
                      <span>{line.replace(/^[-*]\s+/u, '').trim()}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      <details className="group rounded-xl border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900/80">
        <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400">
          查看原始 Markdown
        </summary>
        <pre className="overflow-x-auto p-4 text-xs text-gray-700 dark:text-slate-300">
          {markdown}
        </pre>
      </details>
    </div>
  );
}
