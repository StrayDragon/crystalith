/**
 * Plugin Registration
 *
 * This file initializes and registers all output plugins.
 * Import this file in the application entry point to ensure
 * all plugins are registered before they are needed.
 */

import { pluginRegistry } from './index';
import { allPlugins } from './allPlugins';

let initialized = false;

/**
 * Register all built-in plugins with the registry.
 * This function is idempotent - calling it multiple times has no effect.
 */
export function initializePlugins(): void {
  if (initialized) return;

  for (const plugin of allPlugins) {
    pluginRegistry.register(plugin);
  }

  initialized = true;
  console.debug(`Registered ${pluginRegistry.size} output plugins`);
}

/**
 * Reset plugin registration (for testing purposes)
 */
export function resetPlugins(): void {
  for (const plugin of allPlugins) {
    pluginRegistry.unregister(plugin.id);
  }
  initialized = false;
}
