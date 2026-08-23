// @crystalith/shared — i18n-aware schema description helper.
//
// Chinese-first, i18n-ready description helper for Zod schemas.
// Uses the locale dictionary `L` (zh/index.json SSOT) for key lookups.
//
// Usage:
//   z.string().describe(desc('ai.timeout'))
//   z.string().openapi({ description: desc('notebook.name') })
//
// When the key is missing from the locale dictionary (e.g., during development
// of a new field), the fallback string is used. This ensures the code always
// compiles even if the locale hasn't been updated yet.
//
// Drift gate: `bun scripts/check-i18n-keys.ts`（挂于 just qa）validates all
// `desc('...')` calls have matching keys in zh/index.json.

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
export function desc(key: string, fallback?: string): string {
  return (L as Record<string, string>)[key] ?? fallback ?? key;
}
