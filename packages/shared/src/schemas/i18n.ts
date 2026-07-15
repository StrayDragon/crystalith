// @crystalith/shared — i18n-aware schema description helper.
//
// Chinese-first, i18n-ready description helper for Zod schemas.
// Uses typesafe-i18n's `L` object for type-safe key lookups.
//
// Usage:
//   z.string().describe(desc('ai.timeout'))
//   z.string().openapi({ description: desc('notebook.name') })
//
// When the key is missing from the locale dictionary (e.g., during development
// of a new field), the fallback string is used. This ensures the code always
// compiles even if the locale hasn't been updated yet.
//
// Future migration path:
//   1. Add locale files (en/index.json, ja/index.json, etc.)
//   2. Automate key detection: `scripts/check-i18n-keys.ts` validates all
//      `desc('...')` calls have matching keys in zh/index.json
//   3. Run typesafe-i18n codegen (if bun/TS compat issue is resolved)
//      or update i18n-types.ts + i18n-util.ts manually

import { L } from '../i18n/i18n-util.js';

/**
 * Schema description helper.
 *
 * @param key - Translation key in typesafe-i18n format (e.g. 'ai.timeout').
 *              MUST exist in packages/shared/src/i18n/zh/index.json.
 * @param fallback - Chinese fallback string when key is missing from dictionary.
 *                   This prevents compile errors during active development.
 * @returns The Chinese description string.
 */
export function desc<K extends string>(key: K, fallback?: string): string {
  return (L as Record<string, string>)[key] ?? fallback ?? key;
}
