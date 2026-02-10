import { useMemo } from 'react';
import { Menu, MenuHandler, MenuList, MenuItem, Spinner } from '@material-tailwind/react';
import { Download as DownloadIcon } from '@mui/icons-material';

import type { OutputItem, OutputTypeId } from '../../shared/types';
import { LAYER_LEVELS } from '../../../../shared/layer';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { pluginRegistry } from './plugins';
import { initializePlugins } from './plugins/registerPlugins';
import { EXPORT_FORMAT_LABELS } from './exporters';
import { useExport } from './useExport';
import GenericOutputRenderer from './GenericOutputRenderer';

interface OutputContentProps {
  output: OutputItem;
}

// Ensure plugins are initialized
initializePlugins();

export default function OutputContent({ output }: OutputContentProps) {
  const content = output.content ?? {};
  const isFallback = (content as any)._fallback === true;
  const typeId = output.type as OutputTypeId;
  const { isExporting, activeFormat, getSupportedFormats, exportOutput } = useExport();
  const renderDescriptor = useWorkspaceStore((s) => s.outputTypeRenderDescriptors[typeId] ?? null);

  const supportedFormats = useMemo(() => getSupportedFormats(typeId), [getSupportedFormats, typeId]);

  // Get the plugin for this output type
  const plugin = useMemo(() => pluginRegistry.get(typeId), [typeId]);

  const body = plugin ? (
    plugin.render(content, isFallback)
  ) : renderDescriptor ? (
    <GenericOutputRenderer content={content} renderDescriptor={renderDescriptor} />
  ) : (
    <pre className="StructuredOutputRaw rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
      {JSON.stringify(output.content ?? {}, null, 2)}
    </pre>
  );

  return (
    <div className="space-y-3">
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
