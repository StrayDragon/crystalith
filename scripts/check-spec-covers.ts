#!/usr/bin/env bun
import { existsSync, type Dirent } from 'node:fs';
/**
 * Spec↔test 覆盖门禁：每个「有场景」的 @req:rN 必须有代码侧 `// covers: rN` 锚，
 * 或在豁免登记 llmanspec/spec-coverage-exemptions.json 中带原因登记。
 *
 * - 锚扫描取整行 covers: 注释（斜杠 rN 列表全解析），覆盖 apps/packages/e2e 全部 .ts/.tsx
 *  （含 bdd/runner.ts 等非 *.test 文件）。
 * - 豁免登记同时被校验：已锚的 rN 不得滞留登记（防债台隐形）；登记必须含 reason/seam。
 *
 * Usage: bun scripts/check-spec-covers.ts（just qa 内置）
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = import.meta.dir + '/..';
const SPECS_DIR = join(ROOT, 'llmanspec/specs');
const EXEMPT_PATH = join(ROOT, 'llmanspec/spec-coverage-exemptions.json');
const SCAN_ROOTS = ['apps', 'packages', 'e2e'].map((d) => join(ROOT, d));

interface ReqInfo {
  capability: string;
  scenario: boolean;
}

const reqs = new Map<string, ReqInfo>();
for (const f of await listFeatures(SPECS_DIR)) {
  let cur: string | null = null;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = /^\s*@req:(r\d+)/u.exec(line);
    if (m) {
      cur = m[1]!;
      const capability = f.split('/').pop()!.replace('.feature', '')!;
      reqs.set(cur, { capability, scenario: false });
    } else if (cur && /^\s*场景:/u.test(line)) {
      reqs.get(cur)!.scenario = true;
    }
  }
}

async function listFeatures(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFeatures(p)));
    else if (e.name.endsWith('.feature')) out.push(p);
  }
  return out;
}

const anchored = new Set<string>();

/** 旁路：依赖目录与构建产物不进锚扫描。 */
function isSkippedDir(name: string): boolean {
  return name === 'node_modules' || name === 'dist' || name === '.tmp';
}

function isTsFile(name: string): boolean {
  return /\.(ts|tsx)$/u.test(name);
}

async function listDirSafe(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** 从一行文本提取 covers rN（非 covers 行返回空）。 */
function anchorIds(line: string): string[] {
  if (!/^\s*\/\/ covers:/u.test(line)) return [];
  return [...line.matchAll(/r\d+/gu)].map((m) => m[0]);
}

async function scanFileAnchors(path: string): Promise<void> {
  for (const line of (await readFile(path, 'utf8')).split('\n')) {
    for (const id of anchorIds(line)) anchored.add(id);
  }
}

async function handleEntry(path: string, e: Dirent): Promise<void> {
  if (!e.isDirectory()) {
    if (isTsFile(e.name)) await scanFileAnchors(path);
    return;
  }
  await collectAnchors(path);
}

async function collectAnchors(dir: string): Promise<void> {
  const entries = (await listDirSafe(dir)).filter((x) => !isSkippedDir(x.name));
  for (const e of entries) await handleEntry(join(dir, e.name), e);
}

for (const root of SCAN_ROOTS) await collectAnchors(root);

interface Exemption {
  capability: string;
  reason: string;
  seam?: string;
}
const exemptions: Record<string, Exemption> = existsSync(EXEMPT_PATH)
  ? (JSON.parse(await readFile(EXEMPT_PATH, 'utf8')) as Record<string, Exemption>)
  : {};

const errors: string[] = [];
const exempted = new Set(Object.keys(exemptions));
for (const [rn, info] of reqs) {
  if (!info.scenario) continue;
  if (anchored.has(rn)) continue;
  if (exempted.has(rn)) {
    const ex = exemptions[rn]!;
    if (!ex.reason) errors.push(`豁免 ${rn} 缺 reason`);
    continue;
  }
  errors.push(`${rn}（${info.capability}）有场景但无 covers 锚且未豁免`);
}
for (const rn of exempted) {
  if (anchored.has(rn)) errors.push(`豁免 ${rn} 已有锚——滞留登记请移除`);
  if (!reqs.has(rn)) errors.push(`豁免 ${rn} 指向不存在的 req`);
}

if (errors.length > 0) {
  console.error(`[check-spec-covers] FAIL — ${errors.length} 项覆盖/登记问题:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const scenarioCount = [...reqs.values()].filter((v) => v.scenario).length;
console.log(
  `[check-spec-covers] OK — ${scenarioCount} 个有场景 req 全覆盖（锚 ${[...reqs.keys()].filter((k) => reqs.get(k)!.scenario && anchored.has(k)).length} + 豁免 ${exempted.size}）`,
);
