import type { ReactNode } from 'react';

import type { FieldDescriptor, RenderDescriptor, RenderLayout } from '../../shared/types';

const MAX_NESTING_DEPTH = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
}

function keyBase(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json ?? String(value);
  } catch {
    return String(value);
  }
}

function createKeyFactory(prefix: string) {
  const counts = new Map<string, number>();
  return (value: unknown): string => {
    const base = `${prefix}:${keyBase(value)}`;
    const ordinal = counts.get(base) ?? 0;
    counts.set(base, ordinal + 1);
    return `${base}:${ordinal}`;
  };
}

function JsonFallback({ value }: { value: unknown }) {
  return (
    <pre className="StructuredOutputRaw rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
      {stringify(value)}
    </pre>
  );
}

function resolveItems(content: unknown, itemsKey: string): unknown[] | null {
  if (Array.isArray(content)) return content;
  if (!isRecord(content)) return null;
  const found = content[itemsKey];
  return Array.isArray(found) ? found : null;
}

function resolveOptionString(
  options: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = options[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function resolveOptionBool(
  options: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = options[key];
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Extract the text content from a value, handling the v1 CitedText pattern
 * `{ text: string, citations: [...] }` — when the value is an object with a
 * `text` string field, return that field instead of JSON-stringifying the
 * whole object. This is the primary fix for "notes show JSON instead of text"
 * after the Rivu AG-UI runtime was removed in favor of embedded JSON content
 * + GenericOutputRenderer (see PROGRESS.v2.e2e.md K12).
 */
function coerceText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(coerceText).filter(Boolean).join(', ');
  if (isRecord(value)) {
    // Handle v1 CitedText: { text: string, citations: [...] }
    if (typeof value.text === 'string') return value.text;
    return stringify(value);
  }
  return typeof value === 'string' ? value : typeof value === 'string' ? value : '';
}

/**
 * Check if a value is a v1 CitedText object: `{ text: string, citations?: [...] }`.
 * Used to decide whether to render citations alongside the text.
 */
function isCitedText(value: unknown): boolean {
  return isRecord(value) && typeof value.text === 'string';
}

/**
 * Render a field value that may be a simple string or a CitedText object.
 * For CitedText, renders the text plus any citations as inline tags.
 */
function renderTextWithCitations(value: unknown): ReactNode {
  if (typeof value === 'string') return <>{value}</>;
  if (isCitedText(value)) {
    const text = (value as Record<string, unknown>).text as string;
    const citations = (value as Record<string, unknown>).citations;
    return (
      <>
        <span>{text}</span>
        {renderCitations(citations)}
      </>
    );
  }
  if (Array.isArray(value)) {
    return (
      <>
        {value.map((item, i) => (
          <span key={i}>
            {i > 0 ? ', ' : ''}
            {renderTextWithCitations(item)}
          </span>
        ))}
      </>
    );
  }
  return <>{coerceText(value)}</>;
}

function renderCitations(value: unknown): ReactNode {
  if (!Array.isArray(value) || value.length === 0) return null;

  const keyForCitation = createKeyFactory('citation');
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {value.slice(0, 6).map((item, index) => {
        // best-effort
        const sourceName = isRecord(item)
          ? (item.source_name ?? item.sourceName ?? item.source_title ?? item.source)
          : null;
        const label =
          typeof sourceName === 'string' && sourceName.trim()
            ? sourceName.trim()
            : `Citation ${index + 1}`;
        return (
          <span
            key={keyForCitation(item)}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {label}
          </span>
        );
      })}
      {value.length > 6 ? (
        <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400">
          +{value.length - 6}
        </span>
      ) : null}
    </div>
  );
}

function FieldBlock({ label, children }: { label: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1">
      {label ? (
        <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">{label}</div>
      ) : null}
      {children}
    </div>
  );
}

function renderFields(
  value: unknown,
  fields: FieldDescriptor[],
  { depth }: { depth: number },
): ReactNode {
  if (!isRecord(value)) return <JsonFallback value={value} />;
  if (depth > MAX_NESTING_DEPTH) {
    return <div className="text-xs text-gray-500 dark:text-slate-400">深度过深，已截断…</div>;
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => {
        const fieldValue = value[field.key];
        const hasChildren = Array.isArray(field.children) && field.children.length > 0;

        let body: ReactNode = null;

        if (hasChildren) {
          if (Array.isArray(fieldValue)) {
            const keyForChildItem = createKeyFactory(`${field.key}:child`);
            body = (
              <div className="space-y-2">
                {fieldValue.slice(0, 20).map((item) => (
                  <div
                    key={keyForChildItem(item)}
                    className="rounded-lg border border-gray-200 p-2 dark:border-slate-700"
                  >
                    {renderFields(item, field.children, { depth: depth + 1 })}
                  </div>
                ))}
                {fieldValue.length > 20 ? (
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    +{fieldValue.length - 20} more…
                  </div>
                ) : null}
              </div>
            );
          } else {
            body = renderFields(fieldValue, field.children, { depth: depth + 1 });
          }
        } else {
          switch (field.type) {
            case 'heading':
              body = (
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {coerceText(fieldValue)}
                </div>
              );
              break;
            case 'badge':
              body = (
                <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-slate-700">
                  {coerceText(fieldValue)}
                </span>
              );
              break;
            case 'date':
              body = (
                <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
                  {coerceText(fieldValue)}
                </span>
              );
              break;
            case 'code':
              body = (
                <pre className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-800 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 whitespace-pre-wrap">
                  {coerceText(fieldValue)}
                </pre>
              );
              break;
            case 'list':
              body = Array.isArray(fieldValue) ? (
                <ul className="list-disc pl-5 text-sm text-gray-800 dark:text-slate-200">
                  {(() => {
                    const keyForListItem = createKeyFactory(`${field.key}:list`);
                    return fieldValue
                      .slice(0, 50)
                      .map((item) => (
                        <li key={keyForListItem(item)}>{renderTextWithCitations(item)}</li>
                      ));
                  })()}
                </ul>
              ) : (
                <div className="text-sm text-gray-800 dark:text-slate-200">
                  {renderTextWithCitations(fieldValue)}
                </div>
              );
              break;
            case 'citation':
              body = renderCitations(fieldValue);
              break;
            default:
              body = (
                <div className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">
                  {renderTextWithCitations(fieldValue)}
                </div>
              );
              break;
          }
        }

        return (
          <FieldBlock key={field.key} label={field.label}>
            {body}
          </FieldBlock>
        );
      })}
    </div>
  );
}

function GenericList({
  content,
  itemsKey,
  ordered,
  fields,
}: {
  content: unknown;
  itemsKey: string;
  ordered: boolean;
  fields: FieldDescriptor[];
}) {
  const items = resolveItems(content, itemsKey);
  if (!items) return <JsonFallback value={content} />;

  const ListTag = ordered ? 'ol' : 'ul';
  const listClassName = ordered ? 'list-decimal' : 'list-disc';
  const keyForItem = createKeyFactory('generic-list-item');

  return (
    <ListTag className={`${listClassName} space-y-2 pl-6`}>
      {items.map((item) => (
        <li key={keyForItem(item)}>
          {fields.length > 0 ? (
            renderFields(item, fields, { depth: 0 })
          ) : (
            <div className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">
              {coerceText(item)}
            </div>
          )}
        </li>
      ))}
    </ListTag>
  );
}

function GenericCards({
  content,
  itemsKey,
  fields,
}: {
  content: unknown;
  itemsKey: string;
  fields: FieldDescriptor[];
}) {
  const items = resolveItems(content, itemsKey);
  if (!items) return <JsonFallback value={content} />;
  const keyForItem = createKeyFactory('generic-card-item');

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={keyForItem(item)}
          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {fields.length > 0 ? (
            renderFields(item, fields, { depth: 0 })
          ) : (
            <JsonFallback value={item} />
          )}
        </div>
      ))}
    </div>
  );
}

function GenericTimeline({
  content,
  itemsKey,
  fields,
}: {
  content: unknown;
  itemsKey: string;
  fields: FieldDescriptor[];
}) {
  const items = resolveItems(content, itemsKey);
  if (!items) return <JsonFallback value={content} />;

  const dateKey = fields.find((field) => field.type === 'date')?.key ?? null;
  const remainingFields = dateKey ? fields.filter((field) => field.key !== dateKey) : fields;
  const keyForItem = createKeyFactory('generic-timeline-item');

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const date = dateKey && isRecord(item) ? item[dateKey] : null;
        return (
          <div key={keyForItem(item)} className="flex gap-3">
            <div className="w-20 flex-shrink-0 text-right">
              <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                {date ? coerceText(date) : ''}
              </div>
            </div>
            <div className="relative flex-1 rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              {remainingFields.length > 0 ? (
                renderFields(item, remainingFields, { depth: 0 })
              ) : (
                <JsonFallback value={item} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GenericSections({
  content,
  itemsKey,
  fields,
}: {
  content: unknown;
  itemsKey: string;
  fields: FieldDescriptor[];
}) {
  const items = resolveItems(content, itemsKey);
  if (!items) return <JsonFallback value={content} />;

  const headingField = fields.find((field) => field.type === 'heading') ?? null;
  const remainingFields = headingField
    ? fields.filter((field) => field.key !== headingField.key)
    : fields;
  const keyForItem = createKeyFactory('generic-section-item');

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const heading = headingField && isRecord(item) ? item[headingField.key] : null;
        return (
          <section
            key={keyForItem(item)}
            className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          >
            {heading ? (
              <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
                {coerceText(heading)}
              </div>
            ) : null}
            {remainingFields.length > 0 ? (
              renderFields(item, remainingFields, { depth: 0 })
            ) : (
              <JsonFallback value={item} />
            )}
          </section>
        );
      })}
    </div>
  );
}

function GenericTable({
  content,
  itemsKey,
  fields,
}: {
  content: unknown;
  itemsKey: string;
  fields: FieldDescriptor[];
}) {
  const items = resolveItems(content, itemsKey);
  if (!items) return <JsonFallback value={content} />;
  if (fields.length === 0) return <JsonFallback value={content} />;
  const keyForItem = createKeyFactory('generic-table-row');

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-slate-900/70">
          <tr>
            {fields.map((field) => (
              <th
                key={field.key}
                className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 whitespace-nowrap"
              >
                {field.label ?? field.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900">
          {items.map((item) => (
            <tr key={keyForItem(item)} className="border-t border-gray-100 dark:border-slate-800">
              {fields.map((field) => {
                const cell = isRecord(item) ? item[field.key] : null;
                return (
                  <td
                    key={field.key}
                    className="px-3 py-2 align-top text-gray-800 dark:text-slate-200"
                  >
                    <span className="whitespace-pre-wrap">{coerceText(cell)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GenericTree({
  content,
  rootKey,
  childrenKey,
  labelKey,
  fields,
}: {
  content: unknown;
  rootKey: string;
  childrenKey: string;
  labelKey: string;
  fields: FieldDescriptor[];
}) {
  const root = isRecord(content) && isRecord(content[rootKey]) ? content[rootKey] : null;
  if (!root) return <JsonFallback value={content} />;

  const renderNode = (node: unknown, depth: number): ReactNode => {
    if (!isRecord(node)) return null;
    if (depth > MAX_NESTING_DEPTH) {
      return <div className="text-xs text-gray-500 dark:text-slate-400">深度过深，已截断…</div>;
    }

    const label = node[labelKey];
    const children = node[childrenKey];
    const keyForChild = createKeyFactory(`generic-tree:${depth}`);

    return (
      <div className="space-y-2">
        {typeof label === 'string' && label.trim() ? (
          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</div>
        ) : null}
        {fields.length > 0 ? renderFields(node, fields, { depth }) : null}
        {Array.isArray(children) && children.length > 0 ? (
          <div className="pl-4 border-l border-gray-200 dark:border-slate-700 space-y-3">
            {children.map((child) => (
              <div key={keyForChild(child)}>{renderNode(child, depth + 1)}</div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      {renderNode(root, 0)}
    </div>
  );
}

function defaultItemsKey(layout: RenderLayout): string {
  switch (layout) {
    case 'timeline':
      return 'events';
    case 'sections':
      return 'sections';
    default:
      return 'items';
  }
}

export default function GenericOutputRenderer({
  content,
  renderDescriptor,
}: {
  content: unknown;
  renderDescriptor?: RenderDescriptor | null;
}) {
  if (!renderDescriptor) {
    return <JsonFallback value={content} />;
  }

  const layout = renderDescriptor.layout;
  const options = isRecord(renderDescriptor.options) ? renderDescriptor.options : {};
  const fields = renderDescriptor.itemSchema?.fields ?? [];

  const itemsKey = resolveOptionString(options, 'itemsKey', defaultItemsKey(layout));
  const ordered = resolveOptionBool(options, 'ordered', false);

  const rootKey = resolveOptionString(options, 'rootKey', 'root');
  const childrenKey = resolveOptionString(options, 'childrenKey', 'children');
  const labelKey = resolveOptionString(options, 'labelKey', 'label');

  switch (layout) {
    case 'list':
      return (
        <GenericList content={content} itemsKey={itemsKey} ordered={ordered} fields={fields} />
      );
    case 'cards':
      return <GenericCards content={content} itemsKey={itemsKey} fields={fields} />;
    case 'timeline':
      return <GenericTimeline content={content} itemsKey={itemsKey} fields={fields} />;
    case 'sections':
      return <GenericSections content={content} itemsKey={itemsKey} fields={fields} />;
    case 'table':
      return <GenericTable content={content} itemsKey={itemsKey} fields={fields} />;
    case 'tree':
      return (
        <GenericTree
          content={content}
          rootKey={rootKey}
          childrenKey={childrenKey}
          labelKey={labelKey}
          fields={fields}
        />
      );
    default:
      console.warn(`GenericOutputRenderer: unsupported layout "${layout as string}"`);
      return <JsonFallback value={content} />;
  }
}
