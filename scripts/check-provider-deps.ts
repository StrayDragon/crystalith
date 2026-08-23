#!/usr/bin/env bun
/**
 * Provider registry ↔ package.json drift check.
 *
 * Every `sdk` package declared in KNOWN_PROVIDERS must be resolvable from
 * apps/server — otherwise selecting that provider at runtime throws
 * module-not-found (the bedrock incident). Adding a registry entry requires
 * adding its dependency in the same change.
 *
 * Usage: bun scripts/check-provider-deps.ts   (exit 1 on drift)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SERVER_DIR = resolve(ROOT, 'apps/server');

// Import the real SSOT instead of text-parsing the registry.
const { KNOWN_PROVIDERS } = (await import(resolve(SERVER_DIR, 'src/ai/providers.ts'))) as {
  KNOWN_PROVIDERS: Record<string, { sdk: string }>;
};

const pkg = JSON.parse(readFileSync(resolve(SERVER_DIR, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

const missing: Array<{ provider: string; sdk: string }> = [];
for (const [provider, entry] of Object.entries(KNOWN_PROVIDERS)) {
  if (!declared.has(entry.sdk)) missing.push({ provider, sdk: entry.sdk });
}

if (missing.length > 0) {
  console.error(
    `[check-provider-deps] FAIL — ${missing.length} provider sdk(s) not declared in apps/server/package.json:`,
  );
  for (const m of missing) console.error(`  - ${m.provider} → ${m.sdk}`);
  console.error('  Fix: bun add <sdk> in apps/server, or remove the registry entry.');
  process.exit(1);
}

console.log(
  `[check-provider-deps] OK — ${Object.keys(KNOWN_PROVIDERS).length} providers, all sdk packages declared`,
);
