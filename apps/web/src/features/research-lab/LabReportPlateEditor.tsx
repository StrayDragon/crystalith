import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  ItalicPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';
import { FootnoteDefinitionPlugin, FootnoteReferencePlugin } from '@platejs/footnote/react';
import { IndentPlugin } from '@platejs/indent/react';
import { ListPlugin } from '@platejs/list/react';
import { MarkdownPlugin } from '@platejs/markdown';
import type { TElement, Value } from 'platejs';
import {
  Plate,
  PlateContent,
  PlateElement,
  usePlateEditor,
  type PlateElementProps,
} from 'platejs/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import remarkGfm from 'remark-gfm';

import CitationPopover from '../workspace/shared/components/citations/CitationPopover';
import type { Citation } from '../workspace/shared/types';
import { citationPillLabel } from './fake/reportDocument';
import { stripFootnoteDefinitions, withFootnoteDefinitions } from './fake/reportFootnotes';
import type { LabCitation } from './fake/types';
import LabReportCiteAside from './LabReportCiteAside';
import {
  LabReportCiteProvider,
  useLabReportCite,
  type CiteActivateOptions,
} from './reportCiteContext';

const BLOCK_IDLE = 'rounded-md px-1.5 -mx-1.5 py-0.5 transition-colors';
const BLOCK_SELECTED = 'rounded-md px-1.5 -mx-1.5 py-0.5 bg-blue-50 ring-1 ring-blue-100';

function useBlockShell(blockId: string) {
  const { selectedBlockId, onSelectBlock, readOnly } = useLabReportCite();
  const selected = selectedBlockId === blockId;
  return {
    className: readOnly
      ? selected
        ? BLOCK_SELECTED
        : `${BLOCK_IDLE} hover:bg-gray-100/80 cursor-pointer`
      : '',
    onClick: (e: MouseEvent) => {
      if (!readOnly) return;
      e.stopPropagation();
      onSelectBlock(blockId);
    },
  };
}

function blockIdOf(element: TElement, fallback: string): string {
  const id = (element as unknown as { id?: string }).id;
  return typeof id === 'string' ? id : fallback;
}

/** Merge browse highlight / click onto PlateElement without wrapping (Slate DOM). */
function withBlockBrowseProps(
  props: PlateElementProps,
  blockId: string,
  baseClass: string,
): PlateElementProps {
  const shell = useBlockShell(blockId);
  const labNodeIds = (props.element as { labNodeIds?: string[] }).labNodeIds;
  const primaryNodeId = labNodeIds?.[0];
  const prevAttrs = (props.attributes ?? {}) as Record<string, unknown>;
  const onClick = (e: MouseEvent<HTMLElement>) => {
    const prev = prevAttrs.onClick;
    if (typeof prev === 'function') {
      (prev as (ev: MouseEvent<HTMLElement>) => void)(e);
    }
    shell.onClick(e);
  };
  return {
    ...props,
    className: `${baseClass} ${shell.className}`,
    attributes: {
      ...props.attributes,
      'data-lab-block-id': blockId,
      ...(primaryNodeId ? { 'data-lab-node-id': primaryNodeId } : {}),
      onClick,
    } as unknown as PlateElementProps['attributes'],
  };
}

function H1Element(props: PlateElementProps) {
  const id = blockIdOf(props.element, 'h1');
  const p = withBlockBrowseProps(
    props,
    id,
    'mt-2 mb-3 text-[22px] font-semibold tracking-tight text-gray-900',
  );
  return <PlateElement {...p} as="h1" />;
}

function H2Element(props: PlateElementProps) {
  const id = blockIdOf(props.element, 'h2');
  const p = withBlockBrowseProps(
    props,
    id,
    'mt-8 mb-2 first:mt-0 text-[17px] font-semibold tracking-tight text-gray-900',
  );
  return <PlateElement {...p} as="h2" />;
}

function H3Element(props: PlateElementProps) {
  const id = blockIdOf(props.element, 'h3');
  const p = withBlockBrowseProps(
    props,
    id,
    'mt-5 mb-1.5 text-[15px] font-semibold tracking-tight text-gray-900',
  );
  return <PlateElement {...p} as="h3" />;
}

function BlockquoteElement(props: PlateElementProps) {
  const id = blockIdOf(props.element, 'bq');
  const p = withBlockBrowseProps(
    props,
    id,
    'my-3 border-l-2 border-gray-200 pl-4 text-gray-600 italic',
  );
  return <PlateElement {...p} as="blockquote" />;
}

function isOrderedListStyle(listStyleType: string | undefined): boolean {
  if (!listStyleType) return false;
  return (
    listStyleType === 'decimal' ||
    listStyleType === 'decimal-leading-zero' ||
    listStyleType === 'lower-alpha' ||
    listStyleType === 'upper-alpha' ||
    listStyleType === 'lower-roman' ||
    listStyleType === 'upper-roman'
  );
}

/**
 * Custom markers only. ListPlugin's default belowNodes wraps ul/ol with native
 * listStyleType — that ::marker + our marker = ghost bullets/numbers.
 */
function ParagraphElement(props: PlateElementProps) {
  const el = props.element as TElement & {
    listStyleType?: string;
    indent?: number;
    listStart?: number;
  };
  const id = blockIdOf(el, 'p');
  const listStyleType = el.listStyleType;
  const indent = typeof el.indent === 'number' ? el.indent : 0;
  const isList = Boolean(listStyleType);
  const ordered = isOrderedListStyle(listStyleType);
  // Bullets always painted here; ordered uses CSS counter when listStart missing.
  const marker =
    isList && !ordered ? '•' : isList && typeof el.listStart === 'number' ? `${el.listStart}.` : '';

  const p = withBlockBrowseProps(
    props,
    id,
    isList
      ? `my-1 text-[14.5px] leading-[1.75] text-gray-800${ordered ? ' lab-report-ordered' : ''}`
      : 'my-2 text-[14.5px] leading-[1.75] text-gray-800',
  );

  if (!isList) {
    return <PlateElement {...p} as="p" />;
  }

  // Do NOT wrap {children} in an extra div — Slate paints a twin leaf.
  const { children, ...rest } = p;
  return (
    <PlateElement
      {...rest}
      as="div"
      className={`${rest.className ?? ''} lab-report-li relative`}
      style={{
        paddingLeft: Math.max(28, (indent > 0 ? indent : 1) * 18 + 10),
        listStyle: 'none',
      }}
    >
      <span
        contentEditable={false}
        className="lab-report-list-marker pointer-events-none absolute left-0 top-[3px] w-6 select-none text-right text-[13px] font-medium text-gray-400"
      >
        {marker}
      </span>
      {children}
    </PlateElement>
  );
}

/**
 * Kill ListPlugin default belowNodes (ul/ol + native ::marker). Keep a plain
 * wrap so indent-list semantics stay; markers come only from ParagraphElement.
 */
const LabListBelowNodes = (props: { element: TElement }) => {
  if (!(props.element as { listStyleType?: string }).listStyleType) return undefined;
  return function LabListWrap({ children }: { children: ReactNode }) {
    return <div className="lab-report-list-wrap m-0 p-0">{children}</div>;
  };
};

/** FootnoteReference → citation pill or graph-node chip (`[^@nodeId]`). */
function CiteFootnoteReference(props: PlateElementProps) {
  const { children, ...rest } = props;
  const { citations, showCitations, activeCitationId, onCite, onLocateNode } = useLabReportCite();
  const identifier = String((props.element as { identifier?: string }).identifier ?? '');
  const isNodeAnchor = identifier.startsWith('@');
  const nodeId = isNodeAnchor ? identifier.slice(1) : '';

  if (isNodeAnchor) {
    if (!showCitations || !nodeId) {
      return (
        <PlateElement
          {...rest}
          as="span"
          className="lab-report-cite-hidden"
          attributes={
            {
              ...rest.attributes,
              contentEditable: false,
              style: { display: 'none' },
            } as unknown as PlateElementProps['attributes']
          }
        >
          {children}
        </PlateElement>
      );
    }
    return (
      <PlateElement
        {...rest}
        as="span"
        className="lab-report-node-ref"
        attributes={
          {
            ...rest.attributes,
            contentEditable: false,
            style: {
              display: 'inline',
              position: 'relative',
              verticalAlign: 'baseline',
              whiteSpace: 'nowrap',
              margin: '0 2px',
            },
          } as unknown as PlateElementProps['attributes']
        }
      >
        <button
          type="button"
          data-lab-node-ref={nodeId}
          contentEditable={false}
          tabIndex={0}
          title={`定位思考图节点 ${nodeId}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLocateNode?.(nodeId);
          }}
          className="lab-report-node-ui relative z-[1] inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none cursor-pointer align-baseline bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200 hover:bg-teal-100"
        >
          图
        </button>
        {children}
      </PlateElement>
    );
  }

  if (!showCitations || !identifier) {
    return (
      <PlateElement
        {...rest}
        as="span"
        className="lab-report-cite-hidden"
        attributes={
          {
            ...rest.attributes,
            contentEditable: false,
            style: { display: 'none' },
          } as unknown as PlateElementProps['attributes']
        }
      >
        {children}
      </PlateElement>
    );
  }
  const c = citations[identifier];
  const active = activeCitationId === identifier;
  return (
    <PlateElement
      {...rest}
      as="span"
      className="lab-report-cite"
      attributes={
        {
          ...rest.attributes,
          contentEditable: false,
          style: {
            display: 'inline',
            position: 'relative',
            verticalAlign: 'baseline',
            whiteSpace: 'nowrap',
            margin: '0 2px',
          },
        } as unknown as PlateElementProps['attributes']
      }
    >
      <button
        type="button"
        data-cite-id={identifier}
        contentEditable={false}
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCite(identifier, { anchorEl: e.currentTarget });
        }}
        className={`lab-report-cite-ui relative z-[1] inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none cursor-pointer align-baseline ${
          active
            ? 'bg-blue-600 text-white'
            : 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100'
        }`}
      >
        {citationPillLabel(c, identifier)}
      </button>
      {/* Void leaf placeholder — sibling of UI, never a second painted label */}
      {children}
    </PlateElement>
  );
}

function FootnoteDefinitionHidden(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="div" className="hidden">
      {props.children}
    </PlateElement>
  );
}

function collectLabNodeIds(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { type?: string; identifier?: string; children?: unknown[] };
  if (n.type === 'footnoteReference') {
    const id = String(n.identifier ?? '');
    if (id.startsWith('@')) {
      const nodeId = id.slice(1);
      if (nodeId && !out.includes(nodeId)) out.push(nodeId);
    }
  }
  if (Array.isArray(n.children)) {
    for (const c of n.children) collectLabNodeIds(c, out);
  }
  return out;
}

function ensureBlockIds(value: Value): Value {
  let i = 0;
  return value.map((node) => {
    if (!('type' in node)) return node;
    const existing = (node as unknown as { id?: string }).id;
    const id = typeof existing === 'string' ? existing : `blk-${i++}`;
    const labNodeIds = collectLabNodeIds(node);
    return {
      ...node,
      id,
      ...(labNodeIds.length ? { labNodeIds } : {}),
    };
  }) as Value;
}

function labCitationToUi(c: LabCitation): Citation {
  return {
    id: c.id,
    chunkId: null,
    sourceId: c.notebookSourceId ?? null,
    sourceName: c.title,
    snippet: c.snippet,
    chunkIndex: 0,
    pageNumber: null,
  };
}

function flashCitePill(pill: HTMLElement) {
  pill.classList.remove('ux-source-locate-flash');
  // force reflow so re-triggering the same animation works
  void pill.offsetWidth;
  pill.classList.add('ux-source-locate-flash');
  window.setTimeout(() => pill.classList.remove('ux-source-locate-flash'), 1400);
}

function resolveCitePill(
  editorRoot: HTMLElement | null,
  citationId: string,
  opts?: CiteActivateOptions,
): { pill: HTMLElement; occurrence: number } | null {
  if (opts?.anchorEl && opts.anchorEl.isConnected) {
    const all = editorRoot
      ? Array.from(
          editorRoot.querySelectorAll<HTMLElement>(
            `button[data-cite-id="${CSS.escape(citationId)}"]`,
          ),
        )
      : [];
    const occurrence = Math.max(0, all.indexOf(opts.anchorEl));
    return { pill: opts.anchorEl, occurrence: Math.max(occurrence, 0) };
  }
  if (!editorRoot) return null;
  const pills = Array.from(
    editorRoot.querySelectorAll<HTMLElement>(`button[data-cite-id="${CSS.escape(citationId)}"]`),
  );
  if (pills.length === 0) return null;
  const occurrence = Math.min(Math.max(0, opts?.occurrence ?? 0), pills.length - 1);
  const pill = pills[occurrence];
  return pill ? { pill, occurrence } : null;
}

export interface LabReportPlateEditorProps {
  documentKey: string;
  markdown: string;
  citations: Record<string, LabCitation>;
  orphanIds: Set<string>;
  showCitations: boolean;
  readOnly: boolean;
  onMarkdownChange: (markdown: string) => void;
  /** Jump to thinking-graph node(s) that used this citation. */
  onLocateCitationOnGraph?: (citationId: string) => void;
  /** Jump to a thinking-graph node from block `[^@nodeId]` anchor. */
  onLocateNodeOnGraph?: (nodeId: string) => void;
}

export default function LabReportPlateEditor({
  documentKey,
  markdown,
  citations,
  orphanIds,
  showCitations,
  readOnly,
  onMarkdownChange,
  onLocateCitationOnGraph,
  onLocateNodeOnGraph,
}: LabReportPlateEditorProps) {
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [activeCiteKey, setActiveCiteKey] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [editorRoot, setEditorRoot] = useState<HTMLElement | null>(null);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const plugins = useMemo(
    () => [
      H1Plugin.withComponent(H1Element),
      H2Plugin.withComponent(H2Element),
      H3Plugin.withComponent(H3Element),
      BlockquotePlugin.withComponent(BlockquoteElement),
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      CodePlugin,
      IndentPlugin,
      ListPlugin.configure({
        render: {
          belowNodes: LabListBelowNodes,
        },
      }),
      FootnoteReferencePlugin.withComponent(CiteFootnoteReference),
      FootnoteDefinitionPlugin.withComponent(FootnoteDefinitionHidden),
      MarkdownPlugin.configure({
        options: {
          remarkPlugins: [remarkGfm],
        },
      }),
    ],
    [],
  );

  const editor = usePlateEditor({
    id: documentKey,
    plugins,
    override: {
      components: {
        p: ParagraphElement,
      },
    },
  });

  const skipNotify = useRef(true);
  const initialMarkdown = useRef(markdown);
  initialMarkdown.current = markdown;
  const citationsRef = useRef(citations);
  citationsRef.current = citations;

  useEffect(() => {
    skipNotify.current = true;
    const md = withFootnoteDefinitions(initialMarkdown.current, citationsRef.current);
    const value = ensureBlockIds(editor.getApi(MarkdownPlugin).markdown.deserialize(md) as Value);
    editor.tf.reset();
    editor.tf.setValue(value.length > 0 ? value : [{ type: 'p', children: [{ text: '' }] }]);
    setActiveCitationId(null);
    setActiveCiteKey(null);
    setSelectedBlockId(null);
    setPopoverRect(null);
    queueMicrotask(() => {
      skipNotify.current = false;
      const el = scrollRef.current?.querySelector(
        '[data-slate-editor="true"]',
      ) as HTMLElement | null;
      setEditorRoot(el);
    });
  }, [documentKey, editor]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => setScrollTop(root.scrollTop);
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-slate-editor="true"]') as HTMLElement | null;
    setEditorRoot(el);
  }, [showCitations, documentKey]);

  const closeCite = useCallback(() => {
    setActiveCitationId(null);
    setActiveCiteKey(null);
    setPopoverRect(null);
  }, []);

  const activateCite = useCallback(
    (citationId: string, opts?: CiteActivateOptions) => {
      if (!citationId) {
        closeCite();
        return;
      }
      const hit = resolveCitePill(editorRoot, citationId, opts);
      if (!hit) {
        setActiveCitationId(citationId);
        setActiveCiteKey(`${citationId}#0`);
        setPopoverRect(null);
        return;
      }
      const { pill, occurrence } = hit;
      const host = pill.closest('[data-lab-block-id]') as HTMLElement | null;
      if (host?.dataset.labBlockId) {
        setSelectedBlockId(host.dataset.labBlockId);
      }
      setActiveCitationId(citationId);
      setActiveCiteKey(`${citationId}#${occurrence}`);

      const scroller = scrollRef.current;
      if (scroller) {
        const sRect = scroller.getBoundingClientRect();
        const pRect = pill.getBoundingClientRect();
        const pad = 48;
        if (pRect.top < sRect.top + pad || pRect.bottom > sRect.bottom - pad) {
          pill.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
      }

      flashCitePill(pill);

      const openAt = () => setPopoverRect(pill.getBoundingClientRect());
      // Wait a frame (and another after smooth scroll) so popover anchors correctly.
      requestAnimationFrame(() => {
        openAt();
        window.setTimeout(openAt, 280);
      });
    },
    [editorRoot, closeCite],
  );

  const citeCtx = useMemo(
    () => ({
      citations,
      orphanIds,
      showCitations,
      activeCitationId,
      activeCiteKey,
      selectedBlockId,
      readOnly,
      onCite: activateCite,
      onLocateNode: onLocateNodeOnGraph,
      onSelectBlock: (id: string | null) => {
        setSelectedBlockId(id);
        if (id) closeCite();
      },
    }),
    [
      citations,
      orphanIds,
      showCitations,
      activeCitationId,
      activeCiteKey,
      selectedBlockId,
      readOnly,
      activateCite,
      closeCite,
      onLocateNodeOnGraph,
    ],
  );

  const popoverCitation = activeCitationId ? citations[activeCitationId] : undefined;
  const popoverUiCitations = useMemo(
    () => (popoverCitation ? [labCitationToUi(popoverCitation)] : []),
    [popoverCitation],
  );

  return (
    <LabReportCiteProvider value={citeCtx}>
      <div className="flex-1 min-h-0 flex bg-[var(--cl-bg)]">
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto bg-white">
          <article
            className={`lab-report-doc px-10 py-10 ${showCitations && readOnly ? 'max-w-2xl ml-auto mr-8' : 'max-w-3xl mx-auto'}`}
          >
            <Plate
              editor={editor}
              onChange={({ value }) => {
                if (skipNotify.current || readOnly) return;
                const raw = editor.getApi(MarkdownPlugin).markdown.serialize({ value });
                onMarkdownChange(stripFootnoteDefinitions(raw));
              }}
            >
              <PlateContent
                readOnly={readOnly}
                className="outline-none min-h-[50vh] text-gray-800 [&_code]:mx-0.5 [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-gray-700 [&_strong]:font-semibold [&_strong]:text-gray-900"
                placeholder={readOnly ? undefined : '编辑研究报告…'}
              />
            </Plate>
          </article>
        </div>
        {readOnly ? <LabReportCiteAside editorRoot={editorRoot} scrollTop={scrollTop} /> : null}
      </div>
      <CitationPopover
        citations={popoverUiCitations}
        isOpen={Boolean(activeCitationId && popoverRect && popoverCitation)}
        onClose={closeCite}
        anchorRect={popoverRect}
        onLocateSource={(citation) => {
          closeCite();
          if (onLocateCitationOnGraph) {
            onLocateCitationOnGraph(citation.id);
            return;
          }
          activateCite(citation.id, {
            occurrence: activeCiteKey ? Number(activeCiteKey.split('#')[1] ?? 0) || 0 : 0,
          });
        }}
        onOpenSource={() => {
          if (popoverCitation?.url) {
            window.open(popoverCitation.url, '_blank', 'noopener,noreferrer');
          }
        }}
      />
    </LabReportCiteProvider>
  );
}
