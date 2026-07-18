import type { JsonDictInput, SourceConnectorDescriptor } from './source-connector-types';

export interface SourceConnectorConfigStepProps {
  selectedConnector: SourceConnectorDescriptor | null;
  configProps: Record<string, any>;
  configRequired: Set<string>;
  connectionConfig: JsonDictInput;
  onUpdateConfig: (key: string, next: unknown, typeHint?: string) => void;
}

export function SourceConnectorConfigStep({
  selectedConnector,
  configProps,
  configRequired,
  connectionConfig,
  onUpdateConfig,
}: SourceConnectorConfigStepProps) {
  if (!selectedConnector) {
    return (
      <div className="text-sm text-gray-700 dark:text-slate-200">未选择连接器，请返回上一页。</div>
    );
  }

  const props = configProps;
  const required = configRequired;
  const keys = Object.keys(props).toSorted((a, b) => a.localeCompare(b));
  if (!keys.length) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">无需配置</div>
        <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
          此连接器没有可配置项，点击「创建绑定」继续。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const field = props[key] ?? {};
        const typeHint = typeof field?.type === 'string' ? field.type : undefined;
        const label =
          typeof field?.title === 'string' && field.title.trim() ? field.title.trim() : key;
        const description =
          typeof field?.description === 'string' && field.description.trim()
            ? field.description.trim()
            : null;
        const enumValues = Array.isArray(field?.enum) ? field.enum : null;
        const isRequired = required.has(key);
        const current = connectionConfig[key];

        if (enumValues) {
          return (
            <label key={key} className="block">
              <div className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                {label}
                {isRequired ? <span className="text-rose-600"> *</span> : null}
              </div>
              {description ? (
                <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
                  {description}
                </div>
              ) : null}
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100"
                value={typeof current === 'string' ? current : ''}
                onChange={(e) => onUpdateConfig(key, e.target.value, typeHint)}
              >
                <option value="">请选择…</option>
                {enumValues.map((v: unknown) => {
                  const text = String(v);
                  return (
                    <option key={text} value={text}>
                      {text}
                    </option>
                  );
                })}
              </select>
            </label>
          );
        }

        if (typeHint === 'boolean') {
          return (
            <label
              key={key}
              className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={Boolean(current)}
                onChange={(e) => onUpdateConfig(key, e.target.checked, typeHint)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {label}
                  {isRequired ? <span className="text-rose-600"> *</span> : null}
                </div>
                {description ? (
                  <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
                    {description}
                  </div>
                ) : null}
              </div>
            </label>
          );
        }

        const inputType = typeHint === 'integer' || typeHint === 'number' ? 'number' : 'text';
        return (
          <label key={key} className="block">
            <div className="text-xs font-semibold text-gray-700 dark:text-slate-200">
              {label}
              {isRequired ? <span className="text-rose-600"> *</span> : null}
            </div>
            {description ? (
              <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
                {description}
              </div>
            ) : null}
            <input
              type={inputType}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100"
              value={
                // eslint-disable-next-line eqeqeq
                current == null
                  ? ''
                  : typeof current === 'string'
                    ? current
                    : typeof current === 'string'
                      ? current
                      : ''
              }
              onChange={(e) => onUpdateConfig(key, e.target.value, typeHint)}
              placeholder={key}
            />
          </label>
        );
      })}
    </div>
  );
}
