import { useEffect, useMemo } from 'react';

import type { OutputItem, OutputTypeId } from '../types';
import { pluginRegistry } from '../plugins';
import { initializePlugins } from '../plugins/registerPlugins';

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
    <pre className="StructuredOutputRaw">{JSON.stringify(output.content ?? {}, null, 2)}</pre>
  );
}
