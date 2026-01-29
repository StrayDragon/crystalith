/**
 * Output Plugin System
 *
 * This module provides a plugin architecture for output card rendering.
 * Each output type (FAQ, GUIDE, TIMELINE, etc.) is implemented as a plugin
 * that can be registered with the plugin registry.
 */

import type { ReactNode } from 'react';
import type { OutputTypeId } from '../../shared/types';

/**
 * Configuration option for an output plugin
 */
export interface PluginConfigOption {
  id: string;
  label: string;
  isDefault?: boolean;
}

/**
 * Configuration schema for an output plugin
 */
export interface PluginConfigSchema {
  quantityOptions?: PluginConfigOption[];
  difficultyOptions?: PluginConfigOption[];
  topicPlaceholder?: string;
  supportsTopic?: boolean;
}

/**
 * Output content structure (generic)
 */
export type OutputContent = Record<string, unknown>;

/**
 * Output Plugin interface
 *
 * Each output type must implement this interface to be registered
 * with the plugin registry.
 */
export interface OutputPlugin {
  /** Unique identifier for this plugin (matches OutputTypeId) */
  id: OutputTypeId;

  /** Display label for the output type */
  label: string;

  /** Short description of what this output type produces */
  description: string;

  /** Color tone for UI theming */
  tone: 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

  /** Icon component for the output type */
  icon: ReactNode;

  /** Default prompt for generating this output type */
  defaultPrompt: string;

  /** Configuration schema for the output generator dialog */
  configSchema: PluginConfigSchema;

  /** Badge text (e.g., "NEW", "BETA") - optional */
  badge?: string;

  /** Whether this plugin is enabled */
  enabled: boolean;

  /**
   * Render function for the output content
   * @param content - The output content to render
   * @param isFallback - Whether this is a fallback/error content
   * @returns React node to render
   */
  render: (content: OutputContent, isFallback?: boolean) => ReactNode;

  /**
   * Validate content structure
   * @param content - The content to validate
   * @returns true if content is valid for this plugin
   */
  validateContent: (content: OutputContent) => boolean;
}

/**
 * Plugin Registry
 *
 * Central registry for all output plugins. Plugins are registered
 * at application startup and can be retrieved by their ID.
 */
class OutputPluginRegistry {
  private plugins = new Map<OutputTypeId, OutputPlugin>();

  /**
   * Register a plugin with the registry
   */
  register(plugin: OutputPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin ${plugin.id} is already registered. Overwriting.`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Unregister a plugin from the registry
   */
  unregister(id: OutputTypeId): boolean {
    return this.plugins.delete(id);
  }

  /**
   * Get a plugin by ID
   */
  get(id: OutputTypeId): OutputPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all registered plugins
   */
  getAll(): OutputPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all enabled plugins
   */
  getEnabled(): OutputPlugin[] {
    return this.getAll().filter((plugin) => plugin.enabled);
  }

  /**
   * Check if a plugin is registered
   */
  has(id: OutputTypeId): boolean {
    return this.plugins.has(id);
  }

  /**
   * Get the number of registered plugins
   */
  get size(): number {
    return this.plugins.size;
  }
}

// Export singleton instance
export const pluginRegistry = new OutputPluginRegistry();

// Re-export for convenience
export type { OutputTypeId };
