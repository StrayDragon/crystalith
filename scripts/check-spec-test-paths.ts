#!/usr/bin/env bun
import { existsSync } from 'node:fs';
/**
 * Spec test-path drift check — 校验 llmanspec specs 场景引用的测试文件都真实存在。
 *
 * Why: spec 场景以「当 运行 <path> 的 X 用例」绑定代码；测试改名/归位/删除时
 * 该引用会静默腐化（2026-10 测试精简时发现 11 处漂移）。本门禁让漂移在
 * `just qa` 即红，而非等人工反查。
 *
 * 解析规则：
 *   - 含 `/` 的引用：依次按 repo 根、apps/server/tests、apps/web/src、
 *     e2e/tests、packages/shared/test 解析，任一存在即通过；
 *   - 裸文件名：按全仓测试文件 basename 集合匹配。
 *
 * Usage: bun scripts/check-spec-test-paths.ts  （just qa 内置）
 * Self-test: CHECK_SPECS_DIR=<临时目录> 指向含坏引用的副本验证负例。
 */
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

const ROOT = import.meta.dir + '/..';
const SPECS_DIR = process.env.CHECK_SPECS_DIR ?? join(ROOT, 'llmanspec/specs');

// 相对形态引用的解析根（历史出现过 sources/xxx、qa/xxx 等 tests 内相对路径）
const RELATIVE_ROOTS = [
  join(ROOT, 'apps/server/tests'),
  join(ROOT, 'apps/web/src'),
  join(ROOT, 'e2e/tests'),
  join(ROOT, 'packages/shared/test'),
];

// 全仓真实测试文件（paths + basenames）
const TEST_GLOBBED_ROOTS = ['apps', 'packages', 'e2e'].map((d) => join(ROOT, d));
const realPaths = new Set<string>();
const realBasenames = new Set<string>();

async function collect(dir: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.tmp') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await collect(p);
    else if (/\.(test|spec)\.(ts|tsx)$/.test(e.name)) {
      realPaths.add(p);
      realBasenames.add(e.name);
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

const REF_RE = /\b[A-Za-z0-9_.\-/]+\.(?:test|spec)\.(?:ts|tsx)\b/g;

function resolves(ref: string): boolean {
  if (ref.includes('/')) {
    if (existsSync(join(ROOT, ref))) return true;
    for (const r of RELATIVE_ROOTS) if (existsSync(join(r, ref))) return true;
    // 前缀容忍：spec 里可能写 tests/sources/x 而 real 是 apps/server/tests/sources/x
    for (const p of realPaths) if (p.endsWith(ref)) return true;
    return false;
  }
  return realBasenames.has(ref);
}

for (const r of TEST_GLOBBED_ROOTS) await collect(r);

const missing: Array<{ feature: string; line: number; ref: string }> = [];
let refCount = 0;
for (const f of await listFeatures(SPECS_DIR)) {
  const lines = (await readFile(f, 'utf8')).split('\n');
  lines.forEach((text, i) => {
    for (const m of text.matchAll(REF_RE)) {
      refCount += 1;
      if (!resolves(m[0])) {
        missing.push({ feature: relative(ROOT, f), line: i + 1, ref: m[0] });
      }
    }
  });
}

if (missing.length > 0) {
  console.error(`[check-spec-test-paths] FAIL — ${missing.length} 个 spec 引用的测试文件不存在:`);
  for (const m of missing) console.error(`  - ${m.ref}  (${m.feature}:${m.line})`);
  process.exit(1);
}
console.log(`[check-spec-test-paths] OK — ${refCount} 处场景测试引用全部可解析`);
