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
// KNOWN_PROVIDERS is module-private; the registry re-derives it via
// resolveModel side effects, so we assert on the exported helpers' shape
// by importing the module and reading its provider-sdk contract from the
// same source file's registry table (text slice kept in sync by the gate
// itself — drift in the table shape fails the Object.entries below).
const providersMod = (await import(resolve(SERVER_DIR, 'src/ai/providers.ts'))) as {
  knownProviders: () => string[];
};

// Fallback-free path: parse the registry table from source. The table is a
// plain object literal `const KNOWN_PROVIDERS = { ... }` with `sdk:` keys.
const src = readFileSync(resolve(SERVER_DIR, 'src/ai/providers.ts'), 'utf8');
const tableMatch = /const KNOWN_PROVIDERS = \{([\s\S]*?)\} as const satisfies/u.exec(src);
if (!tableMatch) {
  console.error('[check-provider-deps] FAIL — KNOWN_PROVIDERS table not found in providers.ts');
  process.exit(1);
}
const sdkRe = /['"]?([\w-]+)['"]?:\s*\{\s*sdk:\s*'([^']+)'/gu;
const providerSdks: Array<{ provider: string; sdk: string }> = [];
let m: RegExpExecArray | null;
while ((m = sdkRe.exec(tableMatch[1])) !== null) {
  providerSdks.push({ provider: m[1]!, sdk: m[2]! });
}
if (providerSdks.length === 0) {
  console.error('[check-provider-deps] FAIL — no provider entries parsed');
  process.exit(1);
}
// Cross-check keys against the runtime helper so a renamed table entry fails here.
const runtimeKeys = new Set(providersMod.knownProviders());

const pkg = JSON.parse(readFileSync(resolve(SERVER_DIR, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

const missing: Array<{ provider: string; sdk: string }> = [];
for (const { provider, sdk } of providerSdks) {
  if (!runtimeKeys.has(provider)) {
    console.error(
      `[check-provider-deps] FAIL — parsed provider '${provider}' missing from knownProviders()`,
    );
    process.exit(1);
  }
  if (!declared.has(sdk)) missing.push({ provider, sdk });
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
  `[check-provider-deps] OK — ${providerSdks.length} providers, all sdk packages declared`,
);
