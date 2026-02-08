import { useEffect, useMemo } from 'react';

import type { OutputItem, OutputTypeId } from '../../shared/types';
import { pluginRegistry } from './plugins';
import { initializePlugins } from './plugins/registerPlugins';

interface OutputContentProps {
  output: OutputItem;
}

// Ensure plugins are initialized
initializePlugins();

export default function OutputContent({ output }: OutputContentProps) {
  const content = output.content ?? {};
  const isFallback = (content as any)._fallback === true;
  const typeId = output.type as OutputTypeId;

  // Get the plugin for this output type
  const plugin = useMemo(() => pluginRegistry.get(typeId), [typeId]);

  // If we have a plugin, use its render function
  if (plugin) {
    return <>{plugin.render(content, isFallback)}</>;
  }

  // Fallback: render as JSON
  return (
    <pre className="StructuredOutputRaw rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">{JSON.stringify(output.content ?? {}, null, 2)}</pre>
  );
}
