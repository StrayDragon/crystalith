/**
 * useOutputPlugin Hook
 *
 * A React hook for accessing and using output plugins.
 */

import { useCallback, useMemo } from 'react';
import { pluginRegistry, type OutputPlugin, type OutputTypeId, type OutputContent } from './index';

/**
 * Hook for accessing a specific output plugin by ID.
 */
export function useOutputPlugin(typeId: OutputTypeId): OutputPlugin | undefined {
  return useMemo(() => pluginRegistry.get(typeId), [typeId]);
}

/**
 * Hook for accessing all registered plugins.
 */
export function useAllPlugins(): OutputPlugin[] {
  return useMemo(() => pluginRegistry.getAll(), []);
}

/**
 * Hook for accessing all enabled plugins.
 */
export function useEnabledPlugins(): OutputPlugin[] {
  return useMemo(() => pluginRegistry.getEnabled(), []);
}

/**
 * Hook for rendering output content using the appropriate plugin.
 * Falls back to JSON display if no plugin is found.
 */
export function useRenderOutput() {
  return useCallback((typeId: OutputTypeId, content: OutputContent, isFallback?: boolean) => {
    const plugin = pluginRegistry.get(typeId);

    if (!plugin) {
      // Fallback: render as JSON
      return (
        <pre className="StructuredOutputRaw rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
    }

    // Use plugin's render function
    return plugin.render(content, isFallback);
  }, []);
}

/**
 * Hook for validating output content against a plugin's schema.
 */
export function useValidateOutput() {
  return useCallback((typeId: OutputTypeId, content: OutputContent): boolean => {
    const plugin = pluginRegistry.get(typeId);
    if (!plugin) return false;
    return plugin.validateContent(content);
  }, []);
}
