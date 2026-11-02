// Host-side plugin registry types. The CrystalithPlugin envelope lives in
// `@crystalith/shared` so official/third-party plugin packages do not import
// this package (would cycle with single-binary static imports).
import type { CrystalithPlugin } from '@crystalith/shared';

export type { CrystalithPlugin, CrystalithPluginKind } from '@crystalith/shared';

export interface PluginRegistration {
  plugin: CrystalithPlugin;
  source: 'builtin' | 'external';
}

export interface PluginSkip {
  errorCode: string;
  message: string;
  hint?: string;
}

export interface PluginLoadReport {
  loaded: string[];
  skipped: Record<string, PluginSkip>;
}
