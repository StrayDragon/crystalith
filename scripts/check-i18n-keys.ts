#!/usr/bin/env bun
/**
 * i18n key drift check — validates every `desc('key')` call in Zod schemas
 * has a matching entry in packages/shared/src/i18n/zh/index.json.
 *
 * Why: desc() accepts an arbitrary string with a runtime fallback so active
 * development always compiles; this gate catches missing keys in CI instead.
 *
 * Usage:
 *   bun scripts/check-i18n-keys.ts          # check mode (exit 1 on drift)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = import.meta.dir + '/..';
const SCHEMAS_DIR = join(ROOT, 'packages/shared/src/schemas');
const DICT_PATH = join(ROOT, 'packages/shared/src/i18n/zh/index.json');

const DESC_CALL_RE = /\bdesc\(\s*(['"])([^'"]+)\1/gu;

/** Strip // line comments and /* … *​/ block comments so doc examples don't count. */
function stripComments(src: string): string {
  return src
    .replaceAll(/\/\*[\s\S]*?\*\//gu, (m) => m.replaceAll(/[^\n]/gu, ' '))
    .replaceAll(/^\s*\/\/.*$/gmu, '');
}

async function listTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await listTsFiles(p)));
    else if (e.name.endsWith('.ts')) files.push(p);
  }
  return files;
}

const dict = JSON.parse(await readFile(DICT_PATH, 'utf8')) as Record<string, string>;
const dictKeys = new Set(Object.keys(dict));

const usedKeys = new Set<string>();
const missing: Array<{ file: string; key: string }> = [];

for (const file of await listTsFiles(SCHEMAS_DIR)) {
  const src = stripComments(await readFile(file, 'utf8'));
  for (const m of src.matchAll(DESC_CALL_RE)) {
    const key = m[2] as string;
    usedKeys.add(key);
    if (!dictKeys.has(key)) missing.push({ file: file.replace(`${ROOT}/`, ''), key });
  }
}

if (missing.length > 0) {
  console.error(
    `[check-i18n-keys] FAIL — ${missing.length} desc() key(s) missing from zh/index.json:`,
  );
  for (const m of missing) console.error(`  - ${m.key}  (${m.file})`);
  process.exit(1);
}

const unused = [...dictKeys].filter((k) => !usedKeys.has(k));
console.log(
  `[check-i18n-keys] OK — ${usedKeys.size} desc() keys all present in dictionary` +
    (unused.length > 0 ? `（${unused.length} 个字典 key 未被 schemas 引用，仅提示）` : ''),
);
